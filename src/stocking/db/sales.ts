// Billing (B1). A sale is a bill header with embedded line items. Completing
// one writes a `scan-out` movement per line (in the same transaction) so
// stock, low-stock, reports and the audit log all keep working unchanged.
// Bill numbers are per-device — offline shops never coordinate a counter.

import { db } from './dexie';
import { applyMovement, uuid } from './products';
import { getGstConfig, getUserId } from '../settings';
import { computeSaleTax, type HeldSale, type Sale, type SaleItem, type TenderType } from '../types';

const q2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const TAG_KEY = 'stocking.deviceTag';
const SEQ_KEY = 'stocking.salesSeq';

/** A stable 2-char tag for this device, so bill numbers from two phones in
 *  the same shop never collide. Generated once, kept in localStorage. */
export function deviceTag(): string {
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
  gstRate?: number;
}

export interface CompleteSaleInput {
  items: SaleLineInput[];
  discount?: number; // ₹ off the whole bill
  /** For an amount-only "quick" sale with no line items — the bill total. */
  manualTotal?: number;
  tenderType: TenderType;
  cashAmount?: number;
  upiAmount?: number;
  /** Required when tenderType is 'credit'; optional otherwise (attributes the
   *  bill to a known customer even when it's paid). */
  customerId?: string;
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
      gstRate: Number(l.gstRate) || 0,
    }));

  const subtotal =
    items.length > 0
      ? items.reduce((t, i) => t + i.qty * i.unitPrice, 0)
      : q2(input.manualTotal ?? 0);
  const discount = Math.min(q2(Math.max(0, input.discount ?? 0)), subtotal);

  const gst = getGstConfig();
  const { taxTotal, addToTotal, breakup } = computeSaleTax(
    items.map((i) => ({ lineTotal: i.qty * i.unitPrice, gstRate: i.gstRate })),
    discount,
    gst,
  );
  const total = q2(subtotal - discount + addToTotal);
  if (total <= 0) throw new Error('Nothing to bill');
  if (input.tenderType === 'credit' && !input.customerId) {
    throw new Error('Pick a customer for a credit bill');
  }
  // On a credit bill no money changes hands now — it goes to the customer's
  // account and is cleared later with a receipt.
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
    taxTotal,
    taxBreakup: breakup,
    total,
    refundOf: null,
    tenderType: input.tenderType,
    customerId: input.customerId ?? null,
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

export async function refundsFor(saleId: string): Promise<Sale[]> {
  return db()
    .sales.where('refundOf')
    .equals(saleId)
    .toArray()
    .then((r) => r.filter((s) => s.deletedAt === null));
}

export interface RefundLineInput {
  productId: string;
  qty: number; // positive — how many units come back
}

/** Record a partial/full customer return against an existing bill. Creates a
 *  new sale row with `refundOf` set and negative amounts, and puts the stock
 *  back. Refund qtys are clamped to what's left un-refunded on each line. */
export async function refundSale(
  originalId: string,
  lines: RefundLineInput[],
  tenderType: TenderType,
  tender?: { cashAmount?: number; upiAmount?: number },
): Promise<Sale> {
  const now = Date.now();
  const orig = await db().sales.get(originalId);
  if (!orig || orig.deletedAt !== null || orig.refundOf) {
    throw new Error('Cannot refund this bill');
  }
  const priorRefunds = await refundsFor(originalId);
  const already = new Map<string, number>();
  for (const r of priorRefunds) {
    for (const i of r.items) {
      already.set(i.productId, (already.get(i.productId) ?? 0) + -i.qty);
    }
  }

  const origSubtotal =
    orig.items.reduce((t, i) => t + i.qty * i.unitPrice, 0) || orig.total;

  const items: SaleItem[] = [];
  for (const req of lines) {
    const src = orig.items.find((i) => i.productId === req.productId);
    if (!src) continue;
    const room = src.qty - (already.get(req.productId) ?? 0);
    const qty = Math.min(q2(Math.max(0, req.qty)), room);
    if (qty <= 0) continue;
    items.push({
      productId: src.productId,
      name: src.name,
      unit: src.unit,
      qty: -qty, // negative — leaving the sale
      unitPrice: src.unitPrice,
      gstRate: src.gstRate,
    });
  }
  if (items.length === 0) throw new Error('Nothing to refund');

  const grossBack = items.reduce((t, i) => t + -i.qty * i.unitPrice, 0);
  // Give back the same share of the original bill discount.
  const discShare =
    origSubtotal > 0 ? q2((orig.discount * grossBack) / origSubtotal) : 0;

  const { taxTotal, addToTotal, breakup } = computeSaleTax(
    items.map((i) => ({ lineTotal: i.qty * i.unitPrice, gstRate: i.gstRate })),
    -discShare,
    getGstConfig(),
  );
  const total = q2(-grossBack + discShare - addToTotal); // negative

  const refund: Sale = {
    id: uuid(),
    billNo: `${orig.billNo}/R`,
    createdAt: now,
    userId: getUserId(),
    items,
    discount: -discShare,
    taxTotal,
    taxBreakup: breakup,
    total,
    refundOf: originalId,
    tenderType,
    // Carry the original's customer so a refund of a credit bill nets that
    // customer's balance down.
    customerId: orig.customerId ?? null,
    cashAmount:
      tenderType === 'cash'
        ? total
        : tenderType === 'split'
          ? -q2(Math.abs(tender?.cashAmount ?? 0))
          : 0,
    upiAmount:
      tenderType === 'upi'
        ? total
        : tenderType === 'split'
          ? -q2(Math.abs(tender?.upiAmount ?? 0))
          : 0,
    note: `refund ${orig.billNo}`,
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
          reason: 'sale-return',
          delta: -i.qty, // positive — back into stock
          note: `refund ${orig.billNo}`,
          allowNegative: true,
        });
      }
      await db().sales.add(refund);
    },
  );
  return refund;
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
  count: number; // number of sale bills (refunds excluded)
  total: number; // net take = gross sales − refunds (includes credit bills)
  cash: number; // net cash in the drawer
  upi: number; // net UPI
  credit: number; // net billed on account — NOT money received today
  units: number;
  discountTotal: number;
  taxCollected: number; // net
  refundCount: number;
  refundTotal: number; // positive ₹ value refunded
  avgBill: number;
  topItems: { name: string; qty: number; value: number }[];
  sales: Sale[]; // newest first — includes refund rows
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
  let credit = 0;
  let units = 0;
  let discountTotal = 0;
  let taxCollected = 0;
  let saleCount = 0;
  let refundCount = 0;
  let refundTotal = 0;
  const byItem = new Map<string, { qty: number; value: number }>();
  for (const s of rows) {
    total += s.total;
    cash += s.cashAmount;
    upi += s.upiAmount;
    if (s.tenderType === 'credit') credit += s.total;
    discountTotal += s.discount ?? 0;
    taxCollected += s.taxTotal ?? 0;
    if (s.refundOf) {
      refundCount++;
      refundTotal += -s.total;
    } else {
      saleCount++;
    }
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
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return {
    from: f,
    to: t,
    count: saleCount,
    total: q2(total),
    cash: q2(cash),
    upi: q2(upi),
    credit: q2(credit),
    units: q2(units),
    discountTotal: q2(discountTotal),
    taxCollected: q2(taxCollected),
    refundCount,
    refundTotal: q2(refundTotal),
    avgBill: saleCount ? Math.round((total + refundTotal) / saleCount) : 0,
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
