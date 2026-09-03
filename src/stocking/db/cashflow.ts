// A rough 7-day cash view. No new data — it reads the khata ledger, open
// orders and unpaid purchases, and drops each expected payment onto a day
// using either a real due date (orders) or an assumed credit period
// (khata customers, suppliers — configurable). Anything past its date is
// collapsed onto "today" as overdue.

import { db } from './dexie';
import { listCustomers } from './customers';
import { orderBalance, purchaseBalance } from '../types';

const DAY = 86_400_000;
const q2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const isoLocal = (ms: number) => new Date(ms).toLocaleDateString('en-CA');
const parseISO = (d: string) => new Date(`${d}T00:00:00`).getTime();

export interface CashflowItem {
  kind: 'khata' | 'order' | 'purchase';
  label: string;
  amount: number; // + expected in, − expected out
  dueDate: string; // 'YYYY-MM-DD' (real for orders, assumed otherwise)
  overdue: boolean;
}

export interface CashflowDay {
  date: string;
  in: number;
  out: number;
  net: number;
  running: number; // cumulative net across the horizon
}

export interface CashflowForecast {
  days: CashflowDay[];
  items: CashflowItem[]; // due within the horizon (+ overdue), earliest first
  totalIn: number;
  totalOut: number;
  net: number;
  custCreditDays: number;
  supplierCreditDays: number;
}

export async function cashflowForecast(opts?: {
  horizon?: number;
  custCreditDays?: number;
  supplierCreditDays?: number;
}): Promise<CashflowForecast> {
  const horizon = opts?.horizon ?? 7;
  const custDays = opts?.custCreditDays ?? 15;
  const supDays = opts?.supplierCreditDays ?? 30;

  const now = Date.now();
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const start = midnight.getTime();
  const end = start + horizon * DAY;

  const [customers, sales, receipts, orders, purchases] = await Promise.all([
    listCustomers(),
    db().sales.toArray(),
    db().receipts.toArray(),
    db().orders.toArray(),
    db().purchases.toArray(),
  ]);

  // khata balance + last activity per customer
  const balBy = new Map<string, number>();
  const lastAct = new Map<string, number>();
  for (const c of customers) balBy.set(c.id, c.openingBalance);
  for (const s of sales) {
    if (!s.customerId || s.deletedAt !== null) continue;
    const owed =
      s.total - s.cashAmount - s.upiAmount - (s.cardAmount ?? 0);
    balBy.set(s.customerId, (balBy.get(s.customerId) ?? 0) + owed);
    lastAct.set(
      s.customerId,
      Math.max(lastAct.get(s.customerId) ?? 0, s.createdAt),
    );
  }
  for (const r of receipts) {
    if (r.deletedAt !== null) continue;
    balBy.set(r.customerId, (balBy.get(r.customerId) ?? 0) - r.amount);
    lastAct.set(
      r.customerId,
      Math.max(lastAct.get(r.customerId) ?? 0, r.receivedAt),
    );
  }

  const items: CashflowItem[] = [];

  for (const c of customers) {
    const bal = q2(balBy.get(c.id) ?? 0);
    if (bal <= 0) continue;
    const base = lastAct.get(c.id) ?? c.updatedAt ?? now;
    const dueMs = base + custDays * DAY;
    items.push({
      kind: 'khata',
      label: c.name,
      amount: bal,
      dueDate: isoLocal(Math.max(dueMs, start)),
      overdue: dueMs < start,
    });
  }

  for (const o of orders) {
    if (o.deletedAt !== null || o.billId) continue;
    const bal = orderBalance(o);
    if (bal <= 0 || !o.dueDate) continue;
    const dueMs = parseISO(o.dueDate);
    if (!Number.isFinite(dueMs)) continue;
    items.push({
      kind: 'order',
      label: `${o.orderNo} · ${o.customerName}`,
      amount: bal,
      dueDate: o.dueDate,
      overdue: dueMs < start,
    });
  }

  for (const p of purchases) {
    if (p.deletedAt !== null) continue;
    const bal = purchaseBalance(p);
    if (bal <= 0) continue;
    const base = p.invoiceDate ? parseISO(p.invoiceDate) : p.receivedAt;
    const dueMs =
      (Number.isFinite(base) ? base : p.receivedAt) + supDays * DAY;
    items.push({
      kind: 'purchase',
      label: `${p.invoiceNo || 'Purchase'} · ${p.supplierName}`,
      amount: -bal,
      dueDate: isoLocal(Math.max(dueMs, start)),
      overdue: dueMs < start,
    });
  }

  const relevant = items.filter((it) => {
    if (it.overdue) return true;
    const ms = parseISO(it.dueDate);
    return ms >= start && ms < end;
  });

  const days: CashflowDay[] = [];
  let running = 0;
  for (let i = 0; i < horizon; i++) {
    let inn = 0;
    let out = 0;
    for (const it of relevant) {
      const bucket = it.overdue
        ? 0
        : Math.floor((parseISO(it.dueDate) - start) / DAY);
      if (bucket !== i) continue;
      if (it.amount >= 0) inn += it.amount;
      else out += -it.amount;
    }
    running = q2(running + inn - out);
    days.push({
      date: isoLocal(start + i * DAY),
      in: q2(inn),
      out: q2(out),
      net: q2(inn - out),
      running,
    });
  }

  const totalIn = q2(
    relevant.filter((i) => i.amount > 0).reduce((t, i) => t + i.amount, 0),
  );
  const totalOut = q2(
    relevant.filter((i) => i.amount < 0).reduce((t, i) => t + -i.amount, 0),
  );

  return {
    days,
    items: relevant.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    totalIn,
    totalOut,
    net: q2(totalIn - totalOut),
    custCreditDays: custDays,
    supplierCreditDays: supDays,
  };
}
