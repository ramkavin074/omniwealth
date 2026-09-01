// Two-way sync with /api/stocking/sync. Offline-first: this only ever runs
// when explicitly asked or opportunistically on app open; nothing on the hot
// path waits for it. Products merge last-write-wins on updatedAt; movements
// are append-only.

import { API_BASE } from './config';
import { db } from './db/dexie';
import type { Movement, Product } from './types';

export interface SyncOutcome {
  ok: boolean;
  pushed: number;
  pulled: number;
  error?: 'auth' | 'network' | 'server';
}

function authToken(): string | null {
  try {
    const raw = localStorage.getItem('stocking.auth');
    if (!raw) return null;
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
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
  const state = await getState();
  const cursor = state?.cursor ?? 0;
  const token = authToken();

  const dirtyProducts = await db()
    .products.where('updatedAt')
    .above(cursor)
    .toArray();
  const dirtyMovements = await db()
    .movements.where('createdAt')
    .above(cursor)
    .toArray();

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/stocking/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      // Bearer for the APK; cookie for the in-OmniWealth page.
      credentials: token ? 'omit' : 'include',
      body: JSON.stringify({
        since: cursor,
        products: dirtyProducts,
        movements: dirtyMovements,
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
    products: Product[];
    movements: Movement[];
  };

  await db().transaction('rw', db().products, db().movements, async () => {
    for (const p of data.products) {
      const local = await db().products.get(p.id);
      if (!local || local.updatedAt < p.updatedAt) {
        await db().products.put({
          ...p,
          costPrice: p.costPrice ?? 0,
          deletedAt: p.deletedAt ?? null,
        });
      }
    }
    if (data.movements.length) {
      await db().movements.bulkPut(
        data.movements.map((m) => ({
          ...m,
          unitCost: m.unitCost ?? null,
          userId: m.userId ?? null,
        })),
      );
    }
  });

  await db().syncState.put({
    id: 'default',
    cursor: data.now,
    lastSyncAt: Date.now(),
  });

  return {
    ok: true,
    pushed: dirtyProducts.length + dirtyMovements.length,
    pulled: data.products.length + data.movements.length,
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
