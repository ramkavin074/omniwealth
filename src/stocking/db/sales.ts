// Billing (B1). A sale is a bill header with embedded line items. Completing
// one writes a `scan-out` movement per line (in the same transaction) so
// stock, low-stock, reports and the audit log all keep working unchanged.
// Bill numbers are per-device — offline shops never coordinate a counter.

import { db } from './dexie';
import { applyMovement, uuid } from './products';
import { getUserId } from '../settings';
import type { HeldSale, Sale, SaleItem, TenderType } from '../types';

const q2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const TAG_KEY = 'stocking.deviceTag';
const SEQ_KEY = 'stocking.salesSeq';

/** A stable 2-char tag for this device, so bill numbers from two phones in
 *  the same shop never collide. Generated once, kept in localStorage. */
function deviceTag(): string {
  try {
    let tag = localStorage.getItem(TAG_KEY);
    if (!tag) {
      const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      tag = A[(Math.random() * A.length) | 0] + A[(Math.random() * A.length) | 0];
      localStorage.setItem(TAG_KEY, tag);
    }
    return tag;
  } catch {
    return 'XX';
  }
}

function nextBillNo(): string {
  let seq = 1;
  try {
    seq = Number(localStorage.getItem(SEQ_KEY) || '0') + 1;
    localStorage.setItem(SEQ_KEY, String(seq));
  } catch {
    /* ignore */
  }
  return `${deviceTag()}-${String(seq).padStart(4, '0')}`;
}

export interface SaleLineInput {
  productId: string;
  name: string;
  unit: SaleItem['unit'];
  qty: number;
  unitPrice: number;
}

export interface CompleteSaleInput {
  items: SaleLineInput[];
  discount?: number; // ₹ off the whole bill
  /** For an amount-only "quick" sale with no line items — the bill total. */
  manualTotal?: number;
  tenderType: TenderType;
  cashAmount?: number;
  upiAmount?: number;
  note?: string;
}

/** Ring up a bill: writes the sale row + one stock-out movement per line,
 *  atomically. Stock is allowed to go negative — the goods are physically
 *  leaving the shop; a negative figure just flags a recount later.
 *  A sale with no items (quick amount entry) records revenue only. */
export async function completeSale(input: CompleteSaleInput): Promise<Sale> {
  const now = Date.now();
  const items: SaleItem[] = input.items
    .filter((l) => l.qty > 0)
    .map((l) => ({
      productId: l.productId,
      name: l.name,
      qty: q2(l.qty),
      unit: l.unit,
      unitPrice: q2(l.unitPrice),
    }));

  const subtotal =
    items.length > 0
      ? items.reduce((t, i) => t + i.qty * i.unitPrice, 0)
      : q2(input.manualTotal ?? 0);
  const discount = Math.min(q2(Math.max(0, input.discount ?? 0)), subtotal);
  const total = q2(subtotal - discount);
  if (total <= 0) throw new Error('Nothing to bill');
  const cashAmount =
    input.tenderType === 'cash'
      ? total
      : input.tenderType === 'split'
        ? q2(input.cashAmount ?? 0)
        : 0;
  const upiAmount =
    input.tenderType === 'upi'
      ? total
      : input.tenderType === 'split'
        ? q2(input.upiAmount ?? 0)
        : 0;

  const sale: Sale = {
    id: uuid(),
    billNo: nextBillNo(),
    createdAt: now,
    userId: getUserId(),
    items,
    discount,
    total,
    tenderType: input.tenderType,
    cashAmount,
    upiAmount,
    note: input.note?.trim() ? input.note.trim() : null,
    updatedAt: now,
    deletedAt: null,
  };

  await db().transaction(
    'rw',
    db().products,
    db().movements,
    db().sales,
    async () => {
      for (const i of items) {
        await applyMovement({
          productId: i.productId,
          reason: 'scan-out',
          delta: -i.qty,
          note: `bill ${sale.billNo}`,
          allowNegative: true,
        });
      }
      await db().sales.add(sale);
    },
  );

  return sale;
}

/** Void a bill: tombstone it and add back the stock it took out. */
export async function voidSale(id: string): Promise<void> {
  const now = Date.now();
  await db().transaction(
    'rw',
    db().products,
    db().movements,
    db().sales,
    async () => {
      const sale = await db().sales.get(id);
      if (!sale || sale.deletedAt !== null) return;
      for (const i of sale.items) {
        await applyMovement({
          productId: i.productId,
          reason: 'correction',
          delta: i.qty,
          note: `void ${sale.billNo}`,
          allowNegative: true,
        });
      }
      await db().sales.update(id, { deletedAt: now, updatedAt: now });
    },
  );
}

export async function getSale(id: string): Promise<Sale | undefined> {
  return db().sales.get(id);
}

/** Most recent live bills, newest first. */
export async function recentSales(limit = 50): Promise<Sale[]> {
  const rows = await db().sales.orderBy('createdAt').reverse().limit(limit * 2)
    .toArray();
  return rows.filter((s) => s.deletedAt === null).slice(0, limit);
}

export interface DaySummary {
  from: number;
  to: number;
  count: number;
  total: number;
  cash: number;
  upi: number;
  units: number;
  discountTotal: number;
  avgBill: number;
  topItems: { name: string; qty: number; value: number }[];
  sales: Sale[]; // newest first
}

/** Summary + bill list for [from, to). Defaults to local "today". */
export async function daySummary(from?: number, to?: number): Promise<DaySummary> {
  let f = from;
  let t = to;
  if (f === undefined || t === undefined) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    f = d.getTime();
    t = f + 86_400_000;
  }
  const rows = (
    await db().sales.where('createdAt').between(f, t, true, false).toArray()
  ).filter((s) => s.deletedAt === null);
  rows.sort((a, b) => b.createdAt - a.createdAt);

  let total = 0;
  let cash = 0;
  let upi = 0;
  let units = 0;
  let discountTotal = 0;
  const byItem = new Map<string, { qty: number; value: number }>();
  for (const s of rows) {
    total += s.total;
    cash += s.cashAmount;
    upi += s.upiAmount;
    discountTotal += s.discount ?? 0;
    for (const i of s.items) {
      units += i.qty;
      const cur = byItem.get(i.name) ?? { qty: 0, value: 0 };
      cur.qty += i.qty;
      cur.value += i.qty * i.unitPrice;
      byItem.set(i.name, cur);
    }
  }
  const topItems = [...byItem.entries()]
    .map(([name, v]) => ({ name, qty: q2(v.qty), value: Math.round(v.value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return {
    from: f,
    to: t,
    count: rows.length,
    total: q2(total),
    cash: q2(cash),
    upi: q2(upi),
    units: q2(units),
    discountTotal: q2(discountTotal),
    avgBill: rows.length ? Math.round(total / rows.length) : 0,
    topItems,
    sales: rows,
  };
}

// ---- held (parked) bills — local only, never synced ----

export async function holdSale(
  items: SaleItem[],
  discount: number,
  label: string,
): Promise<void> {
  await db().heldSales.add({
    id: uuid(),
    createdAt: Date.now(),
    label: label.trim() || new Date().toLocaleTimeString('en-IN'),
    items,
    discount: q2(Math.max(0, discount)),
  });
}

export async function listHeld(): Promise<HeldSale[]> {
  return db().heldSales.orderBy('createdAt').reverse().toArray();
}

/** Pull a held bill back and remove it from the parked list. */
export async function resumeHeld(id: string): Promise<HeldSale | undefined> {
  const h = await db().heldSales.get(id);
  if (h) await db().heldSales.delete(id);
  return h;
}

export async function discardHeld(id: string): Promise<void> {
  await db().heldSales.delete(id);
}
