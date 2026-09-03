// Accountant / CA hand-off (C6). Pulls every transaction in a date range into
// flat registers plus a GST + P&L-ish summary, ready to drop into a CSV or a
// Tally import. This app does not file anything — it feeds the accountant.

import { db } from './dexie';
import { getGstConfig } from '../settings';
import { fyBounds, fyStartYearOf } from './tax';
import type { Purchase, Sale } from '../types';

const q = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const isoDay = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

export type RangeKind =
  | 'this-month'
  | 'last-month'
  | 'this-quarter'
  | 'this-fy'
  | 'custom';

export interface DateRange {
  from: number;
  to: number; // exclusive
  label: string;
}

/** Resolve a named range to [from, to). `custom` needs `fromISO`/`toISO`. */
export function resolveRange(
  kind: RangeKind,
  fromISO?: string,
  toISO?: string,
): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (kind === 'this-month') {
    return {
      from: new Date(y, m, 1).getTime(),
      to: new Date(y, m + 1, 1).getTime(),
      label: `${y}-${String(m + 1).padStart(2, '0')}`,
    };
  }
  if (kind === 'last-month') {
    return {
      from: new Date(y, m - 1, 1).getTime(),
      to: new Date(y, m, 1).getTime(),
      label: `${new Date(y, m - 1, 1).getFullYear()}-${String(
        ((m + 11) % 12) + 1,
      ).padStart(2, '0')}`,
    };
  }
  if (kind === 'this-quarter') {
    const qStartMonth = Math.floor(m / 3) * 3;
    return {
      from: new Date(y, qStartMonth, 1).getTime(),
      to: new Date(y, qStartMonth + 3, 1).getTime(),
      label: `${y}-Q${Math.floor(m / 3) + 1}`,
    };
  }
  if (kind === 'this-fy') {
    const b = fyBounds(fyStartYearOf());
    return { from: b.from, to: b.to, label: `FY ${b.label}` };
  }
  const from = fromISO ? new Date(fromISO + 'T00:00:00').getTime() : 0;
  const to = toISO
    ? new Date(toISO + 'T00:00:00').getTime() + 86_400_000
    : Date.now();
  return { from, to, label: `${fromISO ?? '…'} → ${toISO ?? '…'}` };
}

export interface AcctSaleRow {
  date: string;
  billNo: string;
  party: string;
  isRefund: boolean;
  taxable: number;
  cgst: number;
  sgst: number;
  total: number;
  tender: string;
}
export interface AcctPurchaseRow {
  date: string;
  invoiceNo: string;
  party: string;
  taxable: number;
  gstInput: number;
  total: number;
  paid: number;
}
export interface AcctExpenseRow {
  date: string;
  category: string;
  payee: string;
  amount: number;
  gstInput: number;
  tender: string;
}
export interface AcctReceiptRow {
  date: string;
  customer: string;
  amount: number;
  tender: string;
}
export interface AcctPaymentRow {
  date: string;
  supplier: string;
  amount: number;
}

export interface AcctSummary {
  turnover: number; // net of refunds
  cash: number;
  digital: number; // upi + card
  credit: number; // billed on account
  refunds: number;
  gstOutputByRate: { rate: number; taxable: number; cgst: number; sgst: number }[];
  gstOutputTotal: number;
  gstInputTotal: number; // purchases + expenses
  netGstPayable: number; // max(0, output − input); regular scheme
  purchaseTotal: number;
  expenseTotal: number;
  expenseByCategory: { category: string; amount: number }[];
  grossProfitApprox: number; // turnover − COGS(sold qty × costPrice) − expenses; label as approx
  receivablesNow: number; // as of today, not range end
  payablesNow: number;
}

export interface AccountantExport {
  generatedAt: number;
  range: DateRange;
  store: { gstin: string | null; gstEnabled: boolean };
  sales: AcctSaleRow[];
  purchases: AcctPurchaseRow[];
  expenses: AcctExpenseRow[];
  receipts: AcctReceiptRow[];
  payments: AcctPaymentRow[];
  summary: AcctSummary;
}

const partySale = (s: Sale, custName: (id: string) => string): string =>
  s.customerId ? custName(s.customerId) : 'Counter';

export async function buildAccountantExport(
  range: DateRange,
): Promise<AccountantExport> {
  const gst = getGstConfig();
  const [
    sales,
    purchases,
    expenses,
    receipts,
    payments,
    customers,
    suppliers,
    products,
    movements,
  ] = await Promise.all([
    db().sales.where('createdAt').between(range.from, range.to, true, false).toArray(),
    db().purchases
      .where('receivedAt')
      .between(range.from, range.to, true, false)
      .toArray(),
    db().expenses
      .where('spentAt')
      .between(range.from, range.to, true, false)
      .toArray(),
    db().receipts
      .where('receivedAt')
      .between(range.from, range.to, true, false)
      .toArray(),
    db().supplierPayments.toArray(),
    db().customers.toArray(),
    db().suppliers.toArray(),
    db().products.toArray(),
    db().movements.toArray(),
  ]);

  const custName = (id: string) =>
    customers.find((c) => c.id === id)?.name ?? 'Customer';
  const supName = (id: string) =>
    suppliers.find((s) => s.id === id)?.name ?? 'Supplier';
  const costOf = (id: string) =>
    products.find((p) => p.id === id)?.costPrice ?? 0;

  // ---- sales register ----
  const liveSales = sales.filter((s) => s.deletedAt === null);
  const saleRows: AcctSaleRow[] = liveSales
    .map((s) => {
      const taxable = (s.taxBreakup ?? []).reduce((t, r) => t + r.taxable, 0);
      const cgst = (s.taxBreakup ?? []).reduce((t, r) => t + r.cgst, 0);
      const sgst = (s.taxBreakup ?? []).reduce((t, r) => t + r.sgst, 0);
      return {
        date: isoDay(s.createdAt),
        billNo: s.billNo,
        party: partySale(s, custName),
        isRefund: !!s.refundOf,
        taxable: q(taxable || s.total - cgst - sgst),
        cgst: q(cgst),
        sgst: q(sgst),
        total: q(s.total),
        tender: s.tenderType,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.billNo.localeCompare(b.billNo));

  // ---- purchase register ----
  const livePur = purchases.filter((p) => p.deletedAt === null);
  const purRows: AcctPurchaseRow[] = livePur
    .map((p: Purchase) => ({
      date: isoDay(p.receivedAt),
      invoiceNo: p.invoiceNo || '—',
      party: p.supplierName || supName(p.supplierId),
      taxable: q(p.subtotal),
      gstInput: q(p.gstInput),
      total: q(p.total),
      paid: q(p.paid),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ---- expense register ----
  const liveExp = expenses.filter((e) => e.deletedAt === null);
  const expRows: AcctExpenseRow[] = liveExp
    .map((e) => ({
      date: isoDay(e.spentAt),
      category: e.category,
      payee: e.payee ?? '',
      amount: q(e.amount),
      gstInput: q(e.gstInput ?? 0),
      tender: e.tender,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ---- receipts (khata collections) ----
  const rcptRows: AcctReceiptRow[] = receipts
    .filter((r) => r.deletedAt === null)
    .map((r) => ({
      date: isoDay(r.receivedAt),
      customer: custName(r.customerId),
      amount: q(r.amount),
      tender: r.tender,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ---- supplier payments in range ----
  const payRows: AcctPaymentRow[] = payments
    .filter(
      (p) =>
        p.deletedAt === null &&
        p.paidAt >= range.from &&
        p.paidAt < range.to,
    )
    .map((p) => ({
      date: isoDay(p.paidAt),
      supplier: supName(p.supplierId),
      amount: q(p.amount),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ---- summary ----
  let turnover = 0;
  let cash = 0;
  let digital = 0;
  let credit = 0;
  let refunds = 0;
  const byRate = new Map<number, { taxable: number; cgst: number; sgst: number }>();
  for (const s of liveSales) {
    turnover += s.total;
    cash += s.cashAmount;
    digital += s.upiAmount + (s.cardAmount ?? 0);
    if (s.tenderType === 'credit') credit += s.total;
    if (s.refundOf) refunds += -s.total;
    for (const r of s.taxBreakup ?? []) {
      const cur = byRate.get(r.rate) ?? { taxable: 0, cgst: 0, sgst: 0 };
      cur.taxable += r.taxable;
      cur.cgst += r.cgst;
      cur.sgst += r.sgst;
      byRate.set(r.rate, cur);
    }
  }
  const gstOutputByRate = [...byRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, v]) => ({
      rate,
      taxable: q(v.taxable),
      cgst: q(v.cgst),
      sgst: q(v.sgst),
    }));
  const gstOutputTotal = q(
    gstOutputByRate.reduce((t, r) => t + r.cgst + r.sgst, 0),
  );
  const gstInputTotal = q(
    livePur.reduce((t, p) => t + p.gstInput, 0) +
      liveExp.reduce((t, e) => t + (e.gstInput ?? 0), 0),
  );

  // COGS: units sold in range × current cost (approx — cost can drift).
  let cogs = 0;
  for (const s of liveSales) {
    for (const i of s.items) cogs += i.qty * costOf(i.productId);
  }
  const expenseTotal = q(liveExp.reduce((t, e) => t + e.amount, 0));
  const expenseByCategory = [
    ...liveExp
      .reduce((m, e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount), new Map<string, number>())
      .entries(),
  ]
    .map(([category, amount]) => ({ category, amount: q(amount) }))
    .sort((a, b) => b.amount - a.amount);

  // Closing balances — as of NOW (not range end); labelled as such in the file.
  const salesAll = await db().sales.toArray();
  const receiptsAll = await db().receipts.toArray();
  const owedByCust = new Map<string, number>();
  for (const s of salesAll) {
    if (!s.customerId || s.deletedAt !== null) continue;
    const owed = s.total - s.cashAmount - s.upiAmount - (s.cardAmount ?? 0);
    owedByCust.set(s.customerId, (owedByCust.get(s.customerId) ?? 0) + owed);
  }
  for (const r of receiptsAll) {
    if (r.deletedAt !== null) continue;
    owedByCust.set(r.customerId, (owedByCust.get(r.customerId) ?? 0) - r.amount);
  }
  for (const c of customers) {
    if (c.deletedAt !== null) continue;
    owedByCust.set(c.id, (owedByCust.get(c.id) ?? 0) + (c.openingBalance ?? 0));
  }
  const receivablesNow = q(
    [...owedByCust.values()].reduce((t, v) => t + Math.max(0, v), 0),
  );

  const purAll = await db().purchases.toArray();
  const owedBySup = new Map<string, number>();
  for (const m of movements) {
    if (!m.supplierId || !m.unitCost || m.delta === 0) continue;
    owedBySup.set(
      m.supplierId,
      (owedBySup.get(m.supplierId) ?? 0) + m.delta * m.unitCost,
    );
  }
  for (const p of purAll) {
    if (p.deletedAt !== null) continue;
    owedBySup.set(p.supplierId, (owedBySup.get(p.supplierId) ?? 0) + p.gstInput);
  }
  for (const p of payments) {
    if (p.deletedAt !== null) continue;
    owedBySup.set(p.supplierId, (owedBySup.get(p.supplierId) ?? 0) - p.amount);
  }
  const payablesNow = q(
    [...owedBySup.values()].reduce((t, v) => t + Math.max(0, v), 0),
  );

  return {
    generatedAt: Date.now(),
    range,
    store: { gstin: gst.gstin, gstEnabled: gst.enabled },
    sales: saleRows,
    purchases: purRows,
    expenses: expRows,
    receipts: rcptRows,
    payments: payRows,
    summary: {
      turnover: q(turnover),
      cash: q(cash),
      digital: q(digital),
      credit: q(credit),
      refunds: q(refunds),
      gstOutputByRate,
      gstOutputTotal,
      gstInputTotal,
      netGstPayable: gst.enabled
        ? q(Math.max(0, gstOutputTotal - gstInputTotal))
        : 0,
      purchaseTotal: q(livePur.reduce((t, p) => t + p.total, 0)),
      expenseTotal,
      expenseByCategory,
      grossProfitApprox: q(turnover - cogs - expenseTotal),
      receivablesNow,
      payablesNow,
    },
  };
}
