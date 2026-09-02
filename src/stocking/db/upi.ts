// UPI reconciliation: match money actually received (UpiReceipt rows) against
// the `upi` / `split` bills in the sales ledger, by amount + time. Surfaces
// bills whose money may never have landed, and receipts with no matching bill.

import { db } from './dexie';
import { uuid } from './products';
import type { Sale, UpiReceipt, UpiSource } from '../types';

const q2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** How far a receipt's timestamp may drift from its bill and still match. */
const MATCH_WINDOW_MS = 6 * 60 * 60 * 1000;

export interface AddReceiptInput {
  amount: number;
  receivedAt?: number;
  ref?: string | null;
  payerName?: string | null;
  source?: UpiSource;
  note?: string | null;
}

export async function addReceipt(input: AddReceiptInput): Promise<UpiReceipt> {
  const now = Date.now();
  const r: UpiReceipt = {
    id: uuid(),
    amount: q2(input.amount),
    receivedAt: input.receivedAt ?? now,
    ref: input.ref?.trim() || null,
    payerName: input.payerName?.trim() || null,
    source: input.source ?? 'manual',
    matchedSaleId: null,
    note: input.note?.trim() || null,
    updatedAt: now,
    deletedAt: null,
  };
  await db().upiReceipts.add(r);
  return r;
}

export async function addReceipts(rows: AddReceiptInput[]): Promise<number> {
  let added = 0;
  for (const row of rows) {
    if (!(Number(row.amount) > 0)) continue;
    await addReceipt(row);
    added++;
  }
  return added;
}

export async function updateReceipt(
  id: string,
  patch: Partial<Pick<UpiReceipt, 'amount' | 'ref' | 'payerName' | 'note' | 'matchedSaleId'>>,
): Promise<void> {
  const clean: Partial<UpiReceipt> = { updatedAt: Date.now() };
  if (patch.amount !== undefined) clean.amount = q2(patch.amount);
  if (patch.ref !== undefined) clean.ref = patch.ref?.trim() || null;
  if (patch.payerName !== undefined) clean.payerName = patch.payerName?.trim() || null;
  if (patch.note !== undefined) clean.note = patch.note?.trim() || null;
  if (patch.matchedSaleId !== undefined) clean.matchedSaleId = patch.matchedSaleId;
  await db().upiReceipts.update(id, clean);
}

export async function softDeleteReceipt(id: string): Promise<void> {
  const now = Date.now();
  await db().upiReceipts.update(id, { deletedAt: now, updatedAt: now });
}

async function upiSalesBetween(from: number, to: number): Promise<Sale[]> {
  const rows = await db()
    .sales.where('createdAt')
    .between(from, to, true, false)
    .toArray();
  return rows.filter(
    (s) =>
      s.deletedAt === null &&
      !s.refundOf &&
      (s.tenderType === 'upi' || s.tenderType === 'split') &&
      s.upiAmount > 0,
  );
}

async function liveReceipts(from: number, to: number): Promise<UpiReceipt[]> {
  const rows = await db()
    .upiReceipts.where('receivedAt')
    .between(from, to, true, false)
    .toArray();
  return rows.filter((r) => r.deletedAt === null);
}

/** Greedy nearest-in-time match on equal amount. Persists matchedSaleId on
 *  the receipts. Widens the sales window by MATCH_WINDOW either side. */
export async function autoMatch(from: number, to: number): Promise<number> {
  const [receipts, sales] = await Promise.all([
    liveReceipts(from, to),
    upiSalesBetween(from - MATCH_WINDOW_MS, to + MATCH_WINDOW_MS),
  ]);
  const takenSale = new Set(
    (await db().upiReceipts.toArray())
      .filter((r) => r.deletedAt === null && r.matchedSaleId)
      .map((r) => r.matchedSaleId as string),
  );

  let matched = 0;
  const open = receipts
    .filter((r) => !r.matchedSaleId)
    .sort((a, b) => a.receivedAt - b.receivedAt);

  for (const r of open) {
    let best: { sale: Sale; gap: number } | null = null;
    for (const s of sales) {
      if (takenSale.has(s.id)) continue;
      if (Math.abs(s.upiAmount - r.amount) >= 0.01) continue;
      const gap = Math.abs(s.createdAt - r.receivedAt);
      if (gap > MATCH_WINDOW_MS) continue;
      if (!best || gap < best.gap) best = { sale: s, gap };
    }
    if (best) {
      takenSale.add(best.sale.id);
      await updateReceipt(r.id, { matchedSaleId: best.sale.id });
      matched++;
    }
  }
  return matched;
}

export interface Reconciliation {
  from: number;
  to: number;
  appUpiTotal: number; // Σ upiAmount over upi/split bills
  appUpiCount: number;
  receivedTotal: number; // Σ receipt amount
  receiptCount: number;
  difference: number; // received − app  (0 = square)
  matched: { sale: Sale; receipt: UpiReceipt }[];
  unmatchedSales: Sale[]; // bill says UPI, no receipt found → maybe never arrived
  unmatchedReceipts: UpiReceipt[]; // money in, no bill → maybe an unrecorded sale
}

export async function reconcile(from: number, to: number): Promise<Reconciliation> {
  const [sales, receipts] = await Promise.all([
    upiSalesBetween(from, to),
    liveReceipts(from, to),
  ]);
  const saleById = new Map(sales.map((s) => [s.id, s]));

  const matched: { sale: Sale; receipt: UpiReceipt }[] = [];
  const unmatchedReceipts: UpiReceipt[] = [];
  const matchedSaleIds = new Set<string>();
  for (const r of receipts) {
    const s = r.matchedSaleId ? saleById.get(r.matchedSaleId) : undefined;
    if (s) {
      matched.push({ sale: s, receipt: r });
      matchedSaleIds.add(s.id);
    } else {
      unmatchedReceipts.push(r);
    }
  }
  const unmatchedSales = sales.filter((s) => !matchedSaleIds.has(s.id));

  const appUpiTotal = q2(sales.reduce((t, s) => t + s.upiAmount, 0));
  const receivedTotal = q2(receipts.reduce((t, r) => t + r.amount, 0));

  return {
    from,
    to,
    appUpiTotal,
    appUpiCount: sales.length,
    receivedTotal,
    receiptCount: receipts.length,
    difference: q2(receivedTotal - appUpiTotal),
    matched: matched.sort((a, b) => b.receipt.receivedAt - a.receipt.receivedAt),
    unmatchedSales: unmatchedSales.sort((a, b) => b.createdAt - a.createdAt),
    unmatchedReceipts: unmatchedReceipts.sort(
      (a, b) => b.receivedAt - a.receivedAt,
    ),
  };
}
