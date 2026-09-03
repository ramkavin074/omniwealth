// Credit / khata customers + the receipts ledger. A customer's balance is
// derived, never stored: opening balance + credit-sale totals + refunds of
// those credit bills (negative) − receipts. Same philosophy as the supplier
// "owed" figure.

import { db } from './dexie';
import { uuid } from './products';
import type { CustomerImportRow } from '../import';
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

// ---- migration import ----

export interface CustomerImportResult {
  added: number;
  updated: number;
  skipped: number;
}

const digits = (s: string | null): string =>
  (s ?? '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');

/** Bring a customer master over from an existing billing app. Rows match an
 *  existing customer by phone (10-digit) or exact name; the sheet's balance
 *  column becomes the opening balance. Re-running is safe — existing rows are
 *  updated in place, not duplicated. */
export async function importCustomers(
  rows: CustomerImportRow[],
): Promise<CustomerImportResult> {
  const res: CustomerImportResult = { added: 0, updated: 0, skipped: 0 };
  const now = Date.now();

  await db().transaction('rw', db().customers, async () => {
    const existing = await db().customers.toArray();
    const byPhone = new Map<string, Customer>();
    const byName = new Map<string, Customer>();
    for (const c of existing) {
      if (c.deletedAt !== null) continue;
      const d = digits(c.phone);
      if (d.length === 10) byPhone.set(d, c);
      byName.set(c.name.trim().toLowerCase(), c);
    }

    for (const row of rows) {
      const name = row.name.trim();
      if (!name) {
        res.skipped++;
        continue;
      }
      const d = digits(row.phone);
      const match =
        (d.length === 10 && byPhone.get(d)) ||
        byName.get(name.toLowerCase()) ||
        null;

      if (match) {
        const patch: Partial<Customer> = { updatedAt: now };
        if (row.phone && !match.phone) patch.phone = row.phone.trim();
        if (row.place) patch.place = row.place;
        if (row.gstin) patch.gstin = row.gstin;
        if (row.note) patch.note = row.note;
        if (row.creditLimit > 0) patch.creditLimit = q(row.creditLimit);
        if (row.openingBalance) patch.openingBalance = q(row.openingBalance);
        await db().customers.update(match.id, patch);
        res.updated++;
        continue;
      }

      const customer: Customer = {
        id: uuid(),
        name,
        phone: row.phone?.trim() || null,
        place: row.place,
        gstin: row.gstin,
        creditLimit: q(Math.max(0, row.creditLimit)),
        openingBalance: q(row.openingBalance),
        note: row.note,
        updatedAt: now,
        deletedAt: null,
      };
      await db().customers.add(customer);
      if (customer.phone && digits(customer.phone).length === 10) {
        byPhone.set(digits(customer.phone), customer);
      }
      byName.set(name.toLowerCase(), customer);
      res.added++;
    }
  });

  return res;
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
    againstOrderId: null,
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

/** Every live sale (bill, order-delivery or refund) attributed to a customer. */
async function customerSalesFor(customerId: string): Promise<Sale[]> {
  const rows = await db()
    .sales.where('customerId')
    .equals(customerId)
    .toArray();
  return rows.filter((s) => s.deletedAt === null);
}

/** What a single bill left the customer owing: total minus whatever they paid
 *  on it at the counter (0 on a pure credit bill; the advance on a delivered
 *  order; 0 on a fully-paid bill). */
const owedOnBill = (s: Sale): number => s.total - s.cashAmount - s.upiAmount;

export async function customerBalance(id: string): Promise<number> {
  const c = await getCustomer(id);
  if (!c) return 0;
  const [sales, receipts] = await Promise.all([
    customerSalesFor(id),
    receiptsFor(id),
  ]);
  const owed = sales.reduce((t, s) => t + owedOnBill(s), 0);
  const paid = receipts.reduce((t, r) => t + r.amount, 0);
  return q(c.openingBalance + owed - paid);
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
    salesBy.set(s.customerId, (salesBy.get(s.customerId) ?? 0) + owedOnBill(s));
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
    customerSalesFor(id),
    receiptsFor(id),
  ]);

  const raw: LedgerEntry[] = [
    ...sales
      .filter((s) => owedOnBill(s) !== 0)
      .map(
        (s): LedgerEntry => ({
          kind: 'bill',
          at: s.createdAt,
          billNo: s.billNo,
          amount: owedOnBill(s),
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
