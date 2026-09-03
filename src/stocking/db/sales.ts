// Billing (B1). A sale is a bill header with embedded line items. Completing
// one writes a `scan-out` movement per line (in the same transaction) so
// stock, low-stock, reports and the audit log all keep working unchanged.
// Bill numbers are per-device — offline shops never coordinate a counter.

import { db } from './dexie';
import { addLoyaltyPoints } from './customers';
import { applyMovement, uuid } from './products';
import {
  getGstConfig,
  getLoyaltyConfig,
  getReceiptConfig,
  getUserId,
} from '../settings';
import {
  computeSaleTax,
  saleLineTotal,
  type HeldSale,
  type Sale,
  type SaleItem,
  type TenderType,
} from '../types';

const q2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const TAG_KEY = 'stocking.deviceTag';
const SEQ_KEY = 'stocking.salesSeq';
const SALESMEN_KEY = 'stocking.salesmen';

/** The names typed into the "salesman" field on this device, most-recent
 *  first, capped. Offline, per-device — a quick-pick list, not a roster. */
export function getSalesmen(): string[] {
  try {
    const raw = localStorage.getItem(SALESMEN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberSalesman(name: string): void {
  const n = name.trim();
  if (!n) return;
  try {
    const next = [n, ...getSalesmen().filter((x) => x.toLowerCase() !== n.toLowerCase())].slice(0, 12);
    localStorage.setItem(SALESMEN_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

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
  const core = `${deviceTag()}-${String(seq).padStart(4, '0')}`;
  const series = getReceiptConfig().billSeries;
  return series ? `${series}-${core}` : core;
}

export interface SaleLineInput {
  productId: string;
  name: string;
  unit: SaleItem['unit'];
  qty: number;
  unitPrice: number;
  discount?: number; // ₹ off this line
  discountPct?: number; // % off this line (takes precedence over `discount` when > 0)
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
  cardAmount?: number;
  /** Required when tenderType is 'credit'; optional otherwise (attributes the
   *  bill to a known customer even when it's paid). */
  customerId?: string;
  salesman?: string;
  note?: string;
  /** 'YYYY-MM-DD' — record the bill against a past date (owner entering a
   *  missed bill). Ignored if empty, today, or in the future. */
  billDate?: string;
  /** Loyalty points the customer is spending on this bill. Their ₹ value is
   *  already included in `discount` by the caller; this just tells us how
   *  many points to deduct. */
  loyaltyRedeemPoints?: number;
}

/** Resolve an optional back-date to an epoch-ms timestamp, pinned to noon so
 *  it sits inside the local day. Falls back to `now` for empty / today /
 *  future / unparseable input. */
export function resolveBillTime(billDate: string | undefined, now: number): number {
  if (!billDate) return now;
  const todayISO = new Date(now).toLocaleDateString('en-CA'); // YYYY-MM-DD
  if (billDate >= todayISO) return now;
  const t = new Date(`${billDate}T12:00:00`).getTime();
  return Number.isFinite(t) && t < now ? t : now;
}

/** Ring up a bill: writes the sale row + one stock-out movement per line,
 *  atomically. Stock is allowed to go negative — the goods are physically
 *  leaving the shop; a negative figure just flags a recount later.
 *  A sale with no items (quick amount entry) records revenue only. */
export async function completeSale(input: CompleteSaleInput): Promise<Sale> {
  const now = Date.now();
  const billTime = resolveBillTime(input.billDate, now);
  const items: SaleItem[] = input.items
    .filter((l) => l.qty > 0)
    .map((l) => {
      const unitPrice = q2(l.unitPrice);
      const qty = q2(l.qty);
      const gross = qty * unitPrice;
      const pct = q2(Math.max(0, l.discountPct ?? 0));
      // % is authoritative when given; otherwise use the ₹ amount.
      const disc =
        pct > 0
          ? q2((gross * pct) / 100)
          : q2(Math.max(0, l.discount ?? 0));
      return {
        productId: l.productId,
        name: l.name,
        qty,
        unit: l.unit,
        unitPrice,
        discount: Math.min(disc, gross),
        discountPct: pct,
        gstRate: Number(l.gstRate) || 0,
      };
    });

  const subtotal =
    items.length > 0
      ? items.reduce((t, i) => t + saleLineTotal(i), 0)
      : q2(input.manualTotal ?? 0);
  const discount = Math.min(q2(Math.max(0, input.discount ?? 0)), subtotal);

  const gst = getGstConfig();
  const { taxTotal, addToTotal, breakup } = computeSaleTax(
    items.map((i) => ({ lineTotal: saleLineTotal(i), gstRate: i.gstRate })),
    discount,
    gst,
  );
  const preRound = q2(subtotal - discount + addToTotal);
  // Round the payable to the nearest ₹1 (Indian counter norm). taxBreakup
  // stays as computed on the pre-round figure — the rounding difference is a
  // non-GST adjustment, same as VelSoft's ROUNDED line.
  const roundoff = getReceiptConfig().roundBills
    ? q2(Math.round(preRound) - preRound)
    : 0;
  const total = q2(preRound + roundoff);
  if (total <= 0) throw new Error('Nothing to bill');
  if (input.tenderType === 'credit' && !input.customerId) {
    throw new Error('Pick a customer for a credit bill');
  }
  // On a credit bill no money changes hands now — it goes to the customer's
  // account and is cleared later with a receipt. On a split, the caller gives
  // the UPI + card parts and cash is whatever is left.
  const upiAmount =
    input.tenderType === 'upi'
      ? total
      : input.tenderType === 'split'
        ? q2(Math.max(0, input.upiAmount ?? 0))
        : 0;
  const cardAmount =
    input.tenderType === 'card'
      ? total
      : input.tenderType === 'split'
        ? q2(Math.max(0, input.cardAmount ?? 0))
        : 0;
  const cashAmount =
    input.tenderType === 'cash'
      ? total
      : input.tenderType === 'split'
        ? q2(Math.max(0, total - upiAmount - cardAmount))
        : 0;

  const sale: Sale = {
    id: uuid(),
    billNo: nextBillNo(),
    createdAt: billTime,
    userId: getUserId(),
    items,
    discount,
    taxTotal,
    taxBreakup: breakup,
    roundoff,
    total,
    refundOf: null,
    tenderType: input.tenderType,
    customerId: input.customerId ?? null,
    cashAmount,
    upiAmount,
    cardAmount,
    salesman: input.salesman?.trim() ? input.salesman.trim() : null,
    note: input.note?.trim() ? input.note.trim() : null,
    updatedAt: now,
    deletedAt: null,
  };
  if (sale.salesman) rememberSalesman(sale.salesman);

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
          createdAt: billTime,
        });
      }
      await db().sales.add(sale);
    },
  );

  // Loyalty: credit points earned on this bill, debit any redeemed. Kept out
  // of the sale transaction — a missed points update is recoverable, a rolled
  // -back sale is not.
  if (sale.customerId) {
    const loy = getLoyaltyConfig();
    const earned =
      loy.enabled && loy.earnPer > 0 ? Math.floor(total / loy.earnPer) : 0;
    const redeemed = Math.max(0, Math.round(input.loyaltyRedeemPoints ?? 0));
    if (earned - redeemed !== 0) {
      await addLoyaltyPoints(sale.customerId, earned - redeemed);
    }
  }

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
  tender?: { cashAmount?: number; upiAmount?: number; cardAmount?: number },
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
    // Refund at the line's effective unit price (net of any per-line
    // discount) so the money back is right; the refund line's own discount
    // is 0 (the reduction is already baked into unitPrice here).
    const effUnit =
      src.qty > 0 ? q2(saleLineTotal(src) / src.qty) : src.unitPrice;
    items.push({
      productId: src.productId,
      name: src.name,
      unit: src.unit,
      qty: -qty, // negative — leaving the sale
      unitPrice: effUnit,
      discount: 0,
      discountPct: 0,
      gstRate: src.gstRate,
    });
  }
  if (items.length === 0) throw new Error('Nothing to refund');

  const grossBack = items.reduce((t, i) => t + -i.qty * i.unitPrice, 0);
  // Give back the same share of the original bill discount.
  const discShare =
    origSubtotal > 0 ? q2((orig.discount * grossBack) / origSubtotal) : 0;

  // computeSaleTax bails on a non-positive subtotal, so run it on the positive
  // magnitudes and flip the sign — a refund reverses the same GST the original
  // bill charged (blank breakup here would over-state output GST on GSTR-3B).
  const posTax = computeSaleTax(
    items.map((i) => ({ lineTotal: -saleLineTotal(i), gstRate: i.gstRate })),
    discShare,
    getGstConfig(),
  );
  const taxTotal = q2(-posTax.taxTotal);
  const addToTotal = posTax.addToTotal;
  const breakup = posTax.breakup.map((r) => ({
    rate: r.rate,
    taxable: q2(-r.taxable),
    cgst: q2(-r.cgst),
    sgst: q2(-r.sgst),
  }));
  const preRound = q2(-grossBack + discShare - addToTotal); // negative
  const roundoff = getReceiptConfig().roundBills
    ? q2(Math.round(preRound) - preRound)
    : 0;
  const total = q2(preRound + roundoff);

  const refund: Sale = {
    id: uuid(),
    billNo: `${orig.billNo}/R`,
    createdAt: now,
    userId: getUserId(),
    items,
    discount: -discShare,
    taxTotal,
    taxBreakup: breakup,
    roundoff,
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
    cardAmount:
      tenderType === 'card'
        ? total
        : tenderType === 'split'
          ? -q2(Math.abs(tender?.cardAmount ?? 0))
          : 0,
    salesman: orig.salesman ?? null,
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
  card: number; // net card / swipe
  credit: number; // net billed on account — NOT money received today
  units: number;
  discountTotal: number;
  roundoffTotal: number; // Σ rounding adjustments (net)
  taxCollected: number; // net
  refundCount: number;
  refundTotal: number; // positive ₹ value refunded
  avgBill: number;
  topItems: { name: string; qty: number; value: number }[];
  bySalesman: { name: string; total: number; count: number }[]; // sale bills, desc
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
  let card = 0;
  let credit = 0;
  let units = 0;
  let discountTotal = 0;
  let roundoffTotal = 0;
  let taxCollected = 0;
  let saleCount = 0;
  let refundCount = 0;
  let refundTotal = 0;
  const byItem = new Map<string, { qty: number; value: number }>();
  const byStaff = new Map<string, { total: number; count: number }>();
  for (const s of rows) {
    total += s.total;
    cash += s.cashAmount;
    upi += s.upiAmount;
    card += s.cardAmount ?? 0;
    if (s.tenderType === 'credit') credit += s.total;
    discountTotal += s.discount ?? 0;
    roundoffTotal += s.roundoff ?? 0;
    taxCollected += s.taxTotal ?? 0;
    if (s.refundOf) {
      refundCount++;
      refundTotal += -s.total;
    } else {
      saleCount++;
      if (s.salesman) {
        const cur = byStaff.get(s.salesman) ?? { total: 0, count: 0 };
        cur.total += s.total;
        cur.count += 1;
        byStaff.set(s.salesman, cur);
      }
    }
    for (const i of s.items) {
      units += i.qty;
      const cur = byItem.get(i.name) ?? { qty: 0, value: 0 };
      cur.qty += i.qty;
      cur.value += saleLineTotal(i);
      byItem.set(i.name, cur);
    }
  }
  const topItems = [...byItem.entries()]
    .map(([name, v]) => ({ name, qty: q2(v.qty), value: Math.round(v.value) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const bySalesman = [...byStaff.entries()]
    .map(([name, v]) => ({ name, total: q2(v.total), count: v.count }))
    .sort((a, b) => b.total - a.total);

  return {
    from: f,
    to: t,
    count: saleCount,
    total: q2(total),
    cash: q2(cash),
    upi: q2(upi),
    card: q2(card),
    credit: q2(credit),
    units: q2(units),
    discountTotal: q2(discountTotal),
    roundoffTotal: q2(roundoffTotal),
    taxCollected: q2(taxCollected),
    refundCount,
    refundTotal: q2(refundTotal),
    avgBill: saleCount ? Math.round((total + refundTotal) / saleCount) : 0,
    topItems,
    bySalesman,
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
