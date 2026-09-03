// Two-way sync with /api/stocking/sync. Offline-first: this only ever runs
// when explicitly asked or opportunistically on app open; nothing on the hot
// path waits for it. Products merge last-write-wins on updatedAt; movements
// are append-only.

import { API_BASE } from './config';
import { db } from './db/dexie';
import { cacheGst, cacheTax } from './storeSettings';
import type {
  Customer,
  Expense,
  Movement,
  Order,
  Product,
  Receipt,
  Sale,
  Supplier,
  SupplierPayment,
  UpiReceipt,
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
  const dirtySales = await db()
    .sales.where('updatedAt')
    .above(cursor)
    .toArray();
  const dirtyUpiReceipts = await db()
    .upiReceipts.where('updatedAt')
    .above(cursor)
    .toArray();
  const dirtyCustomers = await db()
    .customers.where('updatedAt')
    .above(cursor)
    .toArray();
  const dirtyReceipts = await db()
    .receipts.where('updatedAt')
    .above(cursor)
    .toArray();
  const dirtyOrders = await db()
    .orders.where('updatedAt')
    .above(cursor)
    .toArray();
  const dirtyExpenses = await db()
    .expenses.where('updatedAt')
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
        sales: dirtySales,
        upiReceipts: dirtyUpiReceipts,
        customers: dirtyCustomers,
        receipts: dirtyReceipts,
        orders: dirtyOrders,
        expenses: dirtyExpenses,
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
    sales?: Sale[];
    upiReceipts?: UpiReceipt[];
    customers?: Customer[];
    receipts?: Receipt[];
    orders?: Order[];
    expenses?: Expense[];
    store?: {
      gstin: string | null;
      gstEnabled: boolean;
      pricesIncludeTax: boolean;
      defaultGstRate: number;
      gstScheme?: 'regular' | 'composition';
      presumptive?: boolean;
    } | null;
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
  const pulledSales = data.sales ?? [];
  const pulledUpi = data.upiReceipts ?? [];
  const pulledCustomers = data.customers ?? [];
  const pulledReceipts = data.receipts ?? [];
  const pulledOrders = data.orders ?? [];
  const pulledExpenses = data.expenses ?? [];

  // Keep the offline GST + tax caches in step with the store's server setup.
  if (data.store) {
    try {
      cacheGst(data.store);
      cacheTax({
        gstScheme: data.store.gstScheme ?? 'regular',
        presumptive: data.store.presumptive ?? true,
      });
    } catch {
      /* ignore */
    }
  }

  await db().transaction(
    'rw',
    [
      db().products,
      db().movements,
      db().suppliers,
      db().supplierPayments,
      db().sales,
      db().upiReceipts,
      db().customers,
      db().receipts,
      db().orders,
      db().expenses,
    ],
    async () => {
      for (const p of data.products) {
        const local = await db().products.get(p.id);
        if (!local || local.updatedAt < p.updatedAt) {
          await db().products.put({
            ...p,
            costPrice: p.costPrice ?? 0,
            expiryDate: p.expiryDate ?? null,
            gstRate: p.gstRate ?? 0,
            hsn: p.hsn ?? null,
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
      for (const s of pulledSales) {
        const local = await db().sales.get(s.id);
        if (!local || local.updatedAt < s.updatedAt) {
          await db().sales.put({
            ...s,
            items: (Array.isArray(s.items) ? s.items : []).map((i) => ({
              ...i,
              discount: i.discount ?? 0,
            })),
            discount: s.discount ?? 0,
            taxTotal: s.taxTotal ?? 0,
            taxBreakup: Array.isArray(s.taxBreakup) ? s.taxBreakup : [],
            refundOf: s.refundOf ?? null,
            customerId: s.customerId ?? null,
            cardAmount: s.cardAmount ?? 0,
            salesman: s.salesman ?? null,
            deletedAt: s.deletedAt ?? null,
          });
        }
      }
      for (const c of pulledCustomers) {
        const local = await db().customers.get(c.id);
        if (!local || local.updatedAt < c.updatedAt) {
          await db().customers.put({
            ...c,
            phone: c.phone ?? null,
            place: c.place ?? null,
            gstin: c.gstin ?? null,
            creditLimit: c.creditLimit ?? 0,
            openingBalance: c.openingBalance ?? 0,
            note: c.note ?? null,
            deletedAt: c.deletedAt ?? null,
          });
        }
      }
      for (const r of pulledReceipts) {
        const local = await db().receipts.get(r.id);
        if (!local || local.updatedAt < r.updatedAt) {
          await db().receipts.put({
            ...r,
            tender: r.tender ?? 'cash',
            againstBillId: r.againstBillId ?? null,
            againstOrderId: r.againstOrderId ?? null,
            note: r.note ?? null,
            deletedAt: r.deletedAt ?? null,
          });
        }
      }
      for (const o of pulledOrders) {
        const local = await db().orders.get(o.id);
        if (!local || local.updatedAt < o.updatedAt) {
          await db().orders.put({
            ...o,
            lines: Array.isArray(o.lines) ? o.lines : [],
            total: o.total ?? 0,
            advancePaid: o.advancePaid ?? 0,
            status: o.status ?? 'booked',
            dueDate: o.dueDate ?? null,
            note: o.note ?? null,
            billId: o.billId ?? null,
            deletedAt: o.deletedAt ?? null,
          });
        }
      }
      for (const e of pulledExpenses) {
        const local = await db().expenses.get(e.id);
        if (!local || local.updatedAt < e.updatedAt) {
          await db().expenses.put({
            ...e,
            category: e.category ?? 'other',
            tender: e.tender ?? 'cash',
            payee: e.payee ?? null,
            note: e.note ?? null,
            gstInput: e.gstInput ?? 0,
            deletedAt: e.deletedAt ?? null,
          });
        }
      }
      for (const r of pulledUpi) {
        const local = await db().upiReceipts.get(r.id);
        if (!local || local.updatedAt < r.updatedAt) {
          await db().upiReceipts.put({
            ...r,
            ref: r.ref ?? null,
            payerName: r.payerName ?? null,
            matchedSaleId: r.matchedSaleId ?? null,
            note: r.note ?? null,
            deletedAt: r.deletedAt ?? null,
          });
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
      dirtyPayments.length +
      dirtySales.length +
      dirtyUpiReceipts.length +
      dirtyCustomers.length +
      dirtyReceipts.length +
      dirtyOrders.length +
      dirtyExpenses.length,
    pulled:
      data.products.length +
      data.movements.length +
      pulledSuppliers.length +
      pulledPayments.length +
      pulledSales.length +
      pulledUpi.length +
      pulledCustomers.length +
      pulledReceipts.length +
      pulledOrders.length +
      pulledExpenses.length,
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
