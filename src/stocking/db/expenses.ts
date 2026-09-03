// Shop running-cost expenses (C3): rent, power, wages, transport, tea…
// NOT stock purchases — a bill from a goods supplier goes through
// db/suppliers.ts (the payables ledger). Every row is client-owned, LWW on
// updatedAt, soft-deleted. Totals are always derived, never stored.

import { db } from './dexie';
import { uuid } from './products';
import type { ExpenseImportRow } from '../import';
import {
  todayISO,
  type Expense,
  type ExpenseCategory,
  type ExpenseTender,
} from '../types';

const q = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** [start, end) epoch ms for the local calendar month containing `at`. */
export function monthBounds(at = Date.now()): { from: number; to: number } {
  const d = new Date(at);
  const from = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  return { from, to };
}

export async function listExpenses(limit = 200): Promise<Expense[]> {
  const rows = await db()
    .expenses.orderBy('spentAt')
    .reverse()
    .limit(limit * 2)
    .toArray();
  return rows.filter((e) => e.deletedAt === null).slice(0, limit);
}

export async function getExpense(id: string): Promise<Expense | undefined> {
  const e = await db().expenses.get(id);
  return e && e.deletedAt === null ? e : undefined;
}

export async function expensesInRange(
  from: number,
  to: number,
): Promise<Expense[]> {
  const rows = await db()
    .expenses.where('spentAt')
    .between(from, to, true, false)
    .toArray();
  return rows
    .filter((e) => e.deletedAt === null)
    .sort((a, b) => b.spentAt - a.spentAt);
}

export interface ExpenseDraft {
  id?: string;
  category: ExpenseCategory;
  amount: number;
  tender: ExpenseTender;
  payee?: string;
  note?: string;
  gstInput?: number;
  spentAt?: number;
}

/** Create (no id) or update (id). Returns the stored row. */
export async function upsertExpense(draft: ExpenseDraft): Promise<Expense> {
  const now = Date.now();
  if (draft.id) {
    const patch: Partial<Expense> = { updatedAt: now };
    if (draft.category !== undefined) patch.category = draft.category;
    if (draft.amount !== undefined) patch.amount = q(Math.max(0, draft.amount));
    if (draft.tender !== undefined) patch.tender = draft.tender;
    if (draft.payee !== undefined) patch.payee = draft.payee.trim() || null;
    if (draft.note !== undefined) patch.note = draft.note.trim() || null;
    if (draft.gstInput !== undefined)
      patch.gstInput = q(Math.max(0, draft.gstInput));
    if (draft.spentAt !== undefined) patch.spentAt = draft.spentAt;
    await db().expenses.update(draft.id, patch);
    return (await db().expenses.get(draft.id)) as Expense;
  }
  const expense: Expense = {
    id: uuid(),
    category: draft.category,
    amount: q(Math.max(0, draft.amount)),
    tender: draft.tender,
    payee: draft.payee?.trim() || null,
    note: draft.note?.trim() || null,
    gstInput: q(Math.max(0, draft.gstInput ?? 0)),
    spentAt: draft.spentAt ?? now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db().expenses.add(expense);
  return expense;
}

export async function softDeleteExpense(id: string): Promise<void> {
  const now = Date.now();
  await db().expenses.update(id, { deletedAt: now, updatedAt: now });
}

// ---- migration import ----

export interface ExpenseImportResult {
  added: number;
  skipped: number;
}

const dayKey = (e: {
  spentAt: number;
  category: string;
  amount: number;
  payee: string | null;
}) =>
  `${new Date(e.spentAt).toISOString().slice(0, 10)}|${e.category}|${e.amount}|${
    e.payee ?? ''
  }`;

/** Bring running-cost vouchers over from an existing billing app. There is no
 *  stable id in a typical expense export, so a row is skipped when a live
 *  expense already matches on date + category + amount + payee (best-effort
 *  re-run safety). */
export async function importExpenses(
  rows: ExpenseImportRow[],
): Promise<ExpenseImportResult> {
  const res: ExpenseImportResult = { added: 0, skipped: 0 };
  const now = Date.now();

  await db().transaction('rw', db().expenses, async () => {
    const existing = await db().expenses.toArray();
    const seen = new Set(
      existing.filter((e) => e.deletedAt === null).map(dayKey),
    );

    for (const row of rows) {
      if (row.amount <= 0) {
        res.skipped++;
        continue;
      }
      const spentAt =
        row.spentAt && row.spentAt !== todayISO()
          ? new Date(row.spentAt + 'T12:00:00').getTime()
          : now;
      const expense: Expense = {
        id: uuid(),
        category: row.category,
        amount: q(row.amount),
        tender: row.tender,
        payee: row.payee,
        note: row.note,
        gstInput: q(Math.max(0, row.gstInput)),
        spentAt,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      const k = dayKey(expense);
      if (seen.has(k)) {
        res.skipped++;
        continue;
      }
      await db().expenses.add(expense);
      seen.add(k);
      res.added++;
    }
  });

  return res;
}

export interface ExpensesSummary {
  from: number;
  to: number;
  total: number;
  count: number;
  cash: number; // paid out of the drawer — reduces expected cash
  upi: number;
  gstInput: number; // total ITC claimable in the period
  byCategory: { category: ExpenseCategory; amount: number }[]; // desc, non-zero
}

/** Totals for [from, to). Defaults to the current calendar month. */
export async function expensesSummary(
  from?: number,
  to?: number,
): Promise<ExpensesSummary> {
  const b = from === undefined || to === undefined ? monthBounds() : null;
  const f = b ? b.from : (from as number);
  const t = b ? b.to : (to as number);
  const rows = await expensesInRange(f, t);

  let total = 0;
  let cash = 0;
  let upi = 0;
  let gstInput = 0;
  const byCat = new Map<ExpenseCategory, number>();
  for (const e of rows) {
    total += e.amount;
    if (e.tender === 'upi') upi += e.amount;
    else cash += e.amount;
    gstInput += e.gstInput;
    byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  }

  return {
    from: f,
    to: t,
    total: q(total),
    count: rows.length,
    cash: q(cash),
    upi: q(upi),
    gstInput: q(gstInput),
    byCategory: [...byCat.entries()]
      .map(([category, amount]) => ({ category, amount: q(amount) }))
      .filter((r) => r.amount > 0)
      .sort((a, b2) => b2.amount - a.amount),
  };
}
