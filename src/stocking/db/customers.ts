// Credit / khata customers + the receipts ledger. A customer's balance is
// derived, never stored: opening balance + credit-sale totals + refunds of
// those credit bills (negative) − receipts. Same philosophy as the supplier
// "owed" figure.

import { db } from './dexie';
import { uuid } from './products';
import type {
  Customer,
  CustomerBalance,
  Receipt,
  ReceiptTender,
  Sale,
} from '../types';

const q = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function listCustomers(): Promise<Customer[]> {
  const all = await db().customers.orderBy('name').toArray();
  return all.filter((c) => c.deletedAt === null);
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  const c = await db().customers.get(id);
  return c && c.deletedAt === null ? c : undefined;
}

export interface CustomerDraft {
  id?: string;
  name: string;
  phone?: string;
  place?: string;
  gstin?: string;
  creditLimit?: number;
  openingBalance?: number;
  note?: string;
}

/** Create (no id) or update (id). Returns the stored row. */
export async function upsertCustomer(draft: CustomerDraft): Promise<Customer> {
  const now = Date.now();
  if (draft.id) {
    const patch: Partial<Customer> = { updatedAt: now };
    if (draft.name !== undefined) patch.name = draft.name.trim();
    if (draft.phone !== undefined) patch.phone = draft.phone.trim() || null;
    if (draft.place !== undefined) patch.place = draft.place.trim() || null;
    if (draft.gstin !== undefined)
      patch.gstin = draft.gstin.trim().toUpperCase() || null;
    if (draft.creditLimit !== undefined)
      patch.creditLimit = q(Math.max(0, draft.creditLimit));
    if (draft.openingBalance !== undefined)
      patch.openingBalance = q(draft.openingBalance);
    if (draft.note !== undefined) patch.note = draft.note.trim() || null;
    await db().customers.update(draft.id, patch);
    return (await db().customers.get(draft.id)) as Customer;
  }
  const customer: Customer = {
    id: uuid(),
    name: draft.name.trim(),
    phone: draft.phone?.trim() || null,
    place: draft.place?.trim() || null,
    gstin: draft.gstin?.trim().toUpperCase() || null,
    creditLimit: q(Math.max(0, draft.creditLimit ?? 0)),
    openingBalance: q(draft.openingBalance ?? 0),
    note: draft.note?.trim() || null,
    updatedAt: now,
    deletedAt: null,
  };
  await db().customers.add(customer);
  return customer;
}

export async function softDeleteCustomer(id: string): Promise<void> {
  const now = Date.now();
  await db().customers.update(id, { deletedAt: now, updatedAt: now });
}

// ---- receipts ----

export async function addReceipt(input: {
  customerId: string;
  amount: number;
  tender: ReceiptTender;
  againstBillId?: string | null;
  note?: string;
  receivedAt?: number;
}): Promise<Receipt> {
  const now = Date.now();
  const receipt: Receipt = {
    id: uuid(),
    customerId: input.customerId,
    amount: q(Math.max(0, input.amount)),
    tender: input.tender,
    againstBillId: input.againstBillId ?? null,
    note: input.note?.trim() || null,
    receivedAt: input.receivedAt ?? now,
    updatedAt: now,
    deletedAt: null,
  };
  await db().receipts.add(receipt);
  return receipt;
}

export async function softDeleteReceipt(id: string): Promise<void> {
  const now = Date.now();
  await db().receipts.update(id, { deletedAt: now, updatedAt: now });
}

export async function receiptsFor(customerId: string): Promise<Receipt[]> {
  const rows = await db()
    .receipts.where('customerId')
    .equals(customerId)
    .toArray();
  return rows
    .filter((r) => r.deletedAt === null)
    .sort((a, b) => b.receivedAt - a.receivedAt);
}

// ---- balances ----

/** Credit sales (and their refunds) attributed to a customer, live only. */
async function creditSalesFor(customerId: string): Promise<Sale[]> {
  const rows = await db()
    .sales.where('customerId')
    .equals(customerId)
    .toArray();
  return rows.filter(
    (s) => s.deletedAt === null && (s.tenderType === 'credit' || !!s.refundOf),
  );
}

export async function customerBalance(id: string): Promise<number> {
  const c = await getCustomer(id);
  if (!c) return 0;
  const [sales, receipts] = await Promise.all([
    creditSalesFor(id),
    receiptsFor(id),
  ]);
  const salesTotal = sales.reduce((t, s) => t + s.total, 0); // refunds are negative
  const paid = receipts.reduce((t, r) => t + r.amount, 0);
  return q(c.openingBalance + salesTotal - paid);
}

export interface ReceivablesRow {
  customer: Customer;
  balance: number;
  overLimit: boolean;
}

export interface Receivables {
  total: number; // Σ positive balances
  overLimitCount: number;
  rows: ReceivablesRow[]; // every customer, sorted by balance desc
}

export async function allReceivables(): Promise<Receivables> {
  const [customers, allSales, allReceipts] = await Promise.all([
    listCustomers(),
    db().sales.toArray(),
    db().receipts.toArray(),
  ]);

  const salesBy = new Map<string, number>();
  for (const s of allSales) {
    if (!s.customerId || s.deletedAt !== null) continue;
    if (s.tenderType !== 'credit' && !s.refundOf) continue;
    salesBy.set(s.customerId, (salesBy.get(s.customerId) ?? 0) + s.total);
  }
  const paidBy = new Map<string, number>();
  for (const r of allReceipts) {
    if (r.deletedAt !== null) continue;
    paidBy.set(r.customerId, (paidBy.get(r.customerId) ?? 0) + r.amount);
  }

  const rows: ReceivablesRow[] = customers.map((customer) => {
    const balance = q(
      customer.openingBalance +
        (salesBy.get(customer.id) ?? 0) -
        (paidBy.get(customer.id) ?? 0),
    );
    const overLimit = customer.creditLimit > 0 && balance > customer.creditLimit;
    return { customer, balance, overLimit };
  });
  rows.sort((a, b) => b.balance - a.balance);

  return {
    total: q(rows.reduce((t, r) => t + Math.max(0, r.balance), 0)),
    overLimitCount: rows.filter((r) => r.overLimit).length,
    rows,
  };
}

export function balanceStatus(
  customer: Pick<Customer, 'creditLimit'>,
  balance: number,
): CustomerBalance['overLimit'] {
  return customer.creditLimit > 0 && balance > customer.creditLimit;
}

export type LedgerEntry =
  | { kind: 'bill'; at: number; billNo: string; amount: number; saleId: string }
  | { kind: 'receipt'; at: number; amount: number; tender: ReceiptTender; receiptId: string };

/** Merged credit bills (+) and receipts (−) for one customer, oldest first,
 *  with a running balance after each entry. */
export async function customerLedger(id: string): Promise<{
  opening: number;
  entries: (LedgerEntry & { running: number })[];
  balance: number;
}> {
  const c = await getCustomer(id);
  const opening = c?.openingBalance ?? 0;
  const [sales, receipts] = await Promise.all([
    creditSalesFor(id),
    receiptsFor(id),
  ]);

  const raw: LedgerEntry[] = [
    ...sales.map(
      (s): LedgerEntry => ({
        kind: 'bill',
        at: s.createdAt,
        billNo: s.billNo,
        amount: s.total,
        saleId: s.id,
      }),
    ),
    ...receipts.map(
      (r): LedgerEntry => ({
        kind: 'receipt',
        at: r.receivedAt,
        amount: -r.amount,
        tender: r.tender,
        receiptId: r.id,
      }),
    ),
  ].sort((a, b) => a.at - b.at);

  let running = opening;
  const entries = raw.map((e) => {
    running = q(running + e.amount);
    return { ...e, running };
  });
  return { opening: q(opening), entries, balance: q(running) };
}
