// Two-way sync with /api/stocking/sync. Offline-first: this only ever runs
// when explicitly asked or opportunistically on app open; nothing on the hot
// path waits for it. Products merge last-write-wins on updatedAt; movements
// are append-only.

import type { Table } from 'dexie';
import { chunkRows } from '@/lib/syncPaging';
import { API_BASE } from './config';
import { db } from './db/dexie';
import { cacheGst, cacheTax, cacheUpiId } from './storeSettings';
import type {
  Customer,
  Expense,
  Movement,
  Order,
  Product,
  Purchase,
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

// Push order matters: parents before the rows that point at them.
const PUSH_ORDER = [
  'products',
  'suppliers',
  'customers',
  'payments',
  'receipts',
  'orders',
  'expenses',
  'purchases',
  'upiReceipts',
  'movements',
  'sales',
] as const;

// A pull of a very large store is spread over pages (the server caps each table
// per response); this bounds the loop so a misbehaving server can't spin it forever.
const MAX_PULL_PAGES = 500;
// `since` far in the future => a push-only request (the server pulls nothing).
const PUSH_ONLY_SINCE = () => Date.now() + 10 * 365 * 86_400_000;

interface SyncResponse {
  now: number;
  /** True when the server stopped at its per-table page limit: ask again from `now`. */
  more?: boolean;
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
  purchases?: Purchase[];
  store?: {
    gstin: string | null;
    gstEnabled: boolean;
    pricesIncludeTax: boolean;
    defaultGstRate: number;
    gstScheme?: 'regular' | 'composition';
    presumptive?: boolean;
    upiId?: string | null;
  } | null;
}

async function post(
  token: string | undefined,
  storeId: string | undefined,
  payload: Record<string, unknown>,
): Promise<{ data: SyncResponse } | { error: NonNullable<SyncOutcome['error']> }> {
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
      body: JSON.stringify(payload),
    });
  } catch {
    return { error: 'network' };
  }
  if (res.status === 401) return { error: 'auth' };
  if (!res.ok) return { error: 'server' };
  try {
    return { data: (await res.json()) as SyncResponse };
  } catch {
    return { error: 'server' };
  }
}

/** Last-write-wins merge of pulled rows: one bulk read, one bulk write. */
async function mergeLww<T extends { id: string; updatedAt: number }>(
  table: Table<T, string>,
  incoming: T[],
  normalize: (row: T) => T,
): Promise<void> {
  if (incoming.length === 0) return;
  const locals = await table.bulkGet(incoming.map((r) => r.id));
  const fresh = incoming
    .filter((r, i) => {
      const local = locals[i];
      return !local || local.updatedAt < r.updatedAt;
    })
    .map(normalize);
  if (fresh.length) await table.bulkPut(fresh);
}

/** Write one pulled page into the local database. Returns how many rows came down. */
async function applyPulled(data: SyncResponse): Promise<number> {
  // The server is the source of truth for the caller's role — keep the local
  // copy in step so UI gating can't drift.
  if (data.role) {
    try {
      const blob = authBlob();
      if (blob.role !== data.role) {
        localStorage.setItem('stocking.auth', JSON.stringify({ ...blob, role: data.role }));
      }
    } catch {
      /* ignore */
    }
  }

  // Keep the offline GST + tax caches in step with the store's server setup.
  if (data.store) {
    try {
      cacheGst(data.store);
      cacheTax({
        gstScheme: data.store.gstScheme ?? 'regular',
        presumptive: data.store.presumptive ?? true,
      });
      cacheUpiId({ upiId: data.store.upiId ?? null });
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
  const pulledPurchases = data.purchases ?? [];

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
      db().purchases,
    ],
    async () => {
      await mergeLww(db().products, data.products, (p) => ({
        ...p,
        costPrice: p.costPrice ?? 0,
        expiryDate: p.expiryDate ?? null,
        gstRate: p.gstRate ?? 0,
        hsn: p.hsn ?? null,
        deletedAt: p.deletedAt ?? null,
      }));
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
      await mergeLww(db().suppliers, pulledSuppliers, (s) => ({ ...s, deletedAt: s.deletedAt ?? null }));
      await mergeLww(db().supplierPayments, pulledPayments, (p) => ({ ...p, deletedAt: p.deletedAt ?? null }));
      await mergeLww(db().sales, pulledSales, (s) => ({
        ...s,
        items: (Array.isArray(s.items) ? s.items : []).map((i) => ({
          ...i,
          discount: i.discount ?? 0,
          discountPct: i.discountPct ?? 0,
        })),
        discount: s.discount ?? 0,
        taxTotal: s.taxTotal ?? 0,
        taxBreakup: Array.isArray(s.taxBreakup) ? s.taxBreakup : [],
        roundoff: s.roundoff ?? 0,
        refundOf: s.refundOf ?? null,
        customerId: s.customerId ?? null,
        cardAmount: s.cardAmount ?? 0,
        salesman: s.salesman ?? null,
        deletedAt: s.deletedAt ?? null,
      }));
      await mergeLww(db().customers, pulledCustomers, (c) => ({
        ...c,
        phone: c.phone ?? null,
        place: c.place ?? null,
        gstin: c.gstin ?? null,
        creditLimit: c.creditLimit ?? 0,
        openingBalance: c.openingBalance ?? 0,
        loyaltyPoints: c.loyaltyPoints ?? 0,
        note: c.note ?? null,
        deletedAt: c.deletedAt ?? null,
      }));
      await mergeLww(db().receipts, pulledReceipts, (r) => ({
        ...r,
        tender: r.tender ?? 'cash',
        againstBillId: r.againstBillId ?? null,
        againstOrderId: r.againstOrderId ?? null,
        note: r.note ?? null,
        deletedAt: r.deletedAt ?? null,
      }));
      await mergeLww(db().orders, pulledOrders, (o) => ({
        ...o,
        lines: Array.isArray(o.lines) ? o.lines : [],
        total: o.total ?? 0,
        advancePaid: o.advancePaid ?? 0,
        status: o.status ?? 'booked',
        dueDate: o.dueDate ?? null,
        note: o.note ?? null,
        billId: o.billId ?? null,
        deletedAt: o.deletedAt ?? null,
      }));
      await mergeLww(db().expenses, pulledExpenses, (e) => ({
        ...e,
        category: e.category ?? 'other',
        tender: e.tender ?? 'cash',
        payee: e.payee ?? null,
        note: e.note ?? null,
        gstInput: e.gstInput ?? 0,
        deletedAt: e.deletedAt ?? null,
      }));
      await mergeLww(db().purchases, pulledPurchases, (p) => ({
        ...p,
        lines: Array.isArray(p.lines) ? p.lines : [],
        invoiceNo: p.invoiceNo ?? '',
        invoiceDate: p.invoiceDate ?? '',
        subtotal: p.subtotal ?? 0,
        gstInput: p.gstInput ?? 0,
        total: p.total ?? 0,
        paid: p.paid ?? 0,
        note: p.note ?? null,
        deletedAt: p.deletedAt ?? null,
      }));
      await mergeLww(db().upiReceipts, pulledUpi, (r) => ({
        ...r,
        ref: r.ref ?? null,
        payerName: r.payerName ?? null,
        matchedSaleId: r.matchedSaleId ?? null,
        note: r.note ?? null,
        deletedAt: r.deletedAt ?? null,
      }));
    },
  );

  return (
    data.products.length +
    data.movements.length +
    pulledSuppliers.length +
    pulledPayments.length +
    pulledSales.length +
    pulledUpi.length +
    pulledCustomers.length +
    pulledReceipts.length +
    pulledOrders.length +
    pulledExpenses.length +
    pulledPurchases.length
  );
}

async function runSync(): Promise<SyncOutcome> {
  const { token, storeId } = authBlob();
  await guardStore(storeId);

  const state = await getState();
  const cursor = state?.cursor ?? 0;
  const changed = <T,>(t: { where: (k: string) => { above: (n: number) => { toArray: () => Promise<T[]> } } }, key: string) =>
    t.where(key).above(cursor).toArray();

  const dirty = {
    products: await changed(db().products, 'updatedAt'),
    suppliers: await changed(db().suppliers, 'updatedAt'),
    customers: await changed(db().customers, 'updatedAt'),
    payments: await changed(db().supplierPayments, 'updatedAt'),
    receipts: await changed(db().receipts, 'updatedAt'),
    orders: await changed(db().orders, 'updatedAt'),
    expenses: await changed(db().expenses, 'updatedAt'),
    purchases: await changed(db().purchases, 'updatedAt'),
    upiReceipts: await changed(db().upiReceipts, 'updatedAt'),
    movements: await changed(db().movements, 'createdAt'),
    sales: await changed(db().sales, 'updatedAt'),
  };
  const pushed = PUSH_ORDER.reduce((n, k) => n + dirty[k].length, 0);
  const fail = (error: NonNullable<SyncOutcome['error']>): SyncOutcome => ({
    ok: false,
    pushed: 0,
    pulled: 0,
    error,
  });

  // 1) Push in batches the server will accept. The cursor does not move until
  //    everything has gone up, so an interrupted sync simply resends (the server
  //    merges by id, so repeats are harmless) and never skips a row.
  for (const chunk of chunkRows(PUSH_ORDER, dirty)) {
    const r = await post(token, storeId, { since: PUSH_ONLY_SINCE(), ...chunk });
    if ('error' in r) return fail(r.error);
  }

  // 2) Pull, a page at a time, until the server says it has sent everything.
  let since = cursor;
  let pulled = 0;
  let finalNow: number | null = null;
  for (let page = 0; page < MAX_PULL_PAGES; page++) {
    const r = await post(token, storeId, { since });
    if ('error' in r) return fail(r.error);
    pulled += await applyPulled(r.data);
    if (!r.data.more) {
      finalNow = r.data.now;
      break;
    }
    if (!(r.data.now > since)) return fail('server'); // no progress: don't spin
    since = r.data.now;
  }
  if (finalNow === null) return fail('server');

  await db().syncState.put({ id: 'default', cursor: finalNow, lastSyncAt: Date.now() });
  return { ok: true, pushed, pulled };
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
