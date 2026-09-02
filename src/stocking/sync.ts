// Two-way sync with /api/stocking/sync. Offline-first: this only ever runs
// when explicitly asked or opportunistically on app open; nothing on the hot
// path waits for it. Products merge last-write-wins on updatedAt; movements
// are append-only.

import { API_BASE } from './config';
import { db } from './db/dexie';
import type {
  Movement,
  Product,
  Supplier,
  SupplierPayment,
} from './types';

export interface SyncOutcome {
  ok: boolean;
  pushed: number;
  pulled: number;
  error?: 'auth' | 'network' | 'server';
}

function authBlob(): { token?: string; storeId?: string; role?: string } {
  try {
    const raw = localStorage.getItem('stocking.auth');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** If this device's data belongs to a different store than the signed-in
 *  one (account switch, store switch), wipe it before syncing. */
async function guardStore(storeId: string | undefined): Promise<void> {
  if (!storeId) return;
  const prev = localStorage.getItem('stocking.storeId');
  if (prev && prev !== storeId) {
    await db().delete();
  }
  if (prev !== storeId) localStorage.setItem('stocking.storeId', storeId);
}

async function getState() {
  return db().syncState.get('default');
}

export async function lastSyncAt(): Promise<number | null> {
  const s = await getState();
  return s?.lastSyncAt ?? null;
}

let inFlight: Promise<SyncOutcome> | null = null;

export function syncNow(): Promise<SyncOutcome> {
  if (!inFlight) {
    inFlight = runSync().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runSync(): Promise<SyncOutcome> {
  const { token, storeId } = authBlob();
  await guardStore(storeId);

  const state = await getState();
  const cursor = state?.cursor ?? 0;

  const dirtyProducts = await db()
    .products.where('updatedAt')
    .above(cursor)
    .toArray();
  const dirtyMovements = await db()
    .movements.where('createdAt')
    .above(cursor)
    .toArray();
  const dirtySuppliers = await db()
    .suppliers.where('updatedAt')
    .above(cursor)
    .toArray();
  const dirtyPayments = await db()
    .supplierPayments.where('updatedAt')
    .above(cursor)
    .toArray();

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/stocking/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(storeId ? { 'x-store-id': storeId } : {}),
      },
      // Bearer for the APK; cookie for the in-OmniWealth page.
      credentials: token ? 'omit' : 'include',
      body: JSON.stringify({
        since: cursor,
        products: dirtyProducts,
        movements: dirtyMovements,
        suppliers: dirtySuppliers,
        payments: dirtyPayments,
      }),
    });
  } catch {
    return { ok: false, pushed: 0, pulled: 0, error: 'network' };
  }

  if (res.status === 401) {
    return { ok: false, pushed: 0, pulled: 0, error: 'auth' };
  }
  if (!res.ok) {
    return { ok: false, pushed: 0, pulled: 0, error: 'server' };
  }

  const data = (await res.json()) as {
    now: number;
    role?: string;
    products: Product[];
    movements: Movement[];
    suppliers?: Supplier[];
    payments?: SupplierPayment[];
  };

  // The server is the source of truth for the caller's role — keep the local
  // copy in step so UI gating can't drift.
  if (data.role) {
    try {
      const blob = authBlob();
      if (blob.role !== data.role) {
        localStorage.setItem(
          'stocking.auth',
          JSON.stringify({ ...blob, role: data.role }),
        );
      }
    } catch {
      /* ignore */
    }
  }

  const pulledSuppliers = data.suppliers ?? [];
  const pulledPayments = data.payments ?? [];

  await db().transaction(
    'rw',
    db().products,
    db().movements,
    db().suppliers,
    db().supplierPayments,
    async () => {
      for (const p of data.products) {
        const local = await db().products.get(p.id);
        if (!local || local.updatedAt < p.updatedAt) {
          await db().products.put({
            ...p,
            costPrice: p.costPrice ?? 0,
            expiryDate: p.expiryDate ?? null,
            deletedAt: p.deletedAt ?? null,
          });
        }
      }
      if (data.movements.length) {
        await db().movements.bulkPut(
          data.movements.map((m) => ({
            ...m,
            unitCost: m.unitCost ?? null,
            supplierId: m.supplierId ?? null,
            userId: m.userId ?? null,
          })),
        );
      }
      for (const s of pulledSuppliers) {
        const local = await db().suppliers.get(s.id);
        if (!local || local.updatedAt < s.updatedAt) {
          await db().suppliers.put({ ...s, deletedAt: s.deletedAt ?? null });
        }
      }
      for (const p of pulledPayments) {
        const local = await db().supplierPayments.get(p.id);
        if (!local || local.updatedAt < p.updatedAt) {
          await db()
            .supplierPayments.put({ ...p, deletedAt: p.deletedAt ?? null });
        }
      }
    },
  );

  await db().syncState.put({
    id: 'default',
    cursor: data.now,
    lastSyncAt: Date.now(),
  });

  return {
    ok: true,
    pushed:
      dirtyProducts.length +
      dirtyMovements.length +
      dirtySuppliers.length +
      dirtyPayments.length,
    pulled:
      data.products.length +
      data.movements.length +
      pulledSuppliers.length +
      pulledPayments.length,
  };
}

/** Fire a sync on app open if online and it's been a while. Never throws. */
export async function maybeAutoSync(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const state = await getState();
  const age = Date.now() - (state?.lastSyncAt ?? 0);
  if (age < 60_000) return;
  try {
    await syncNow();
  } catch {
    /* opportunistic — ignore */
  }
}
