// Day close: reconcile the cash drawer for a business day.

import { db } from './dexie';
import { uuid } from './products';
import { getUserId } from '../settings';
import { cashDifference, dayBounds, expectedCash } from '@/lib/dayClose';
import type { DayClose } from '../types';

const q2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface DayFigures {
  date: string;
  cashSales: number;
  cashReceived: number;
  cashExpenses: number;
  /** Counted cash from the most recent earlier close; the usual opening float. */
  suggestedOpening: number;
  existing: DayClose | null;
}

export async function getClose(date: string): Promise<DayClose | null> {
  const rows = await db().dayCloses.where('date').equals(date).toArray();
  const live = rows.filter((r) => r.deletedAt === null);
  live.sort((a, b) => b.updatedAt - a.updatedAt);
  return live[0] ?? null;
}

export async function listCloses(limit = 14): Promise<DayClose[]> {
  const rows = (await db().dayCloses.toArray()).filter((r) => r.deletedAt === null);
  // One per date: the latest edit wins (two phones may both have closed the day).
  const byDate = new Map<string, DayClose>();
  for (const r of rows) {
    const cur = byDate.get(r.date);
    if (!cur || r.updatedAt > cur.updatedAt) byDate.set(r.date, r);
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

export async function dayFigures(date: string): Promise<DayFigures> {
  const b = dayBounds(date);
  if (!b) throw new Error('Bad date');
  const [sales, receipts, expenses, closes] = await Promise.all([
    db().sales.where('createdAt').between(b.from, b.to, true, false).toArray(),
    db().receipts.where('receivedAt').between(b.from, b.to, true, false).toArray(),
    db().expenses.where('spentAt').between(b.from, b.to, true, false).toArray(),
    listCloses(60),
  ]);
  const prev = closes.find((c) => c.date < date);
  return {
    date,
    cashSales: q2(sales.filter((s) => s.deletedAt === null).reduce((t, s) => t + s.cashAmount, 0)),
    cashReceived: q2(
      receipts.filter((r) => r.deletedAt === null && r.tender === 'cash').reduce((t, r) => t + r.amount, 0),
    ),
    cashExpenses: q2(
      expenses.filter((e) => e.deletedAt === null && e.tender === 'cash').reduce((t, e) => t + e.amount, 0),
    ),
    suggestedOpening: prev ? prev.countedCash : 0,
    existing: await getClose(date),
  };
}

export interface SaveCloseInput {
  date: string;
  openingCash: number;
  otherPaidOut: number;
  countedCash: number;
  note?: string;
}

/** Record (or re-record) the close for a day. Figures are re-read at save time so
 *  the stored row is internally consistent. */
export async function saveClose(input: SaveCloseInput): Promise<DayClose> {
  const f = await dayFigures(input.date);
  const now = Date.now();
  const openingCash = q2(Math.max(0, input.openingCash));
  const otherPaidOut = q2(Math.max(0, input.otherPaidOut));
  const expected = expectedCash({
    openingCash,
    cashSales: f.cashSales,
    cashReceived: f.cashReceived,
    cashExpenses: f.cashExpenses,
    otherPaidOut,
  });
  const countedCash = q2(Math.max(0, input.countedCash));
  const row: DayClose = {
    id: f.existing?.id ?? uuid(),
    date: input.date,
    openingCash,
    cashSales: f.cashSales,
    cashReceived: f.cashReceived,
    cashExpenses: f.cashExpenses,
    otherPaidOut,
    expectedCash: expected,
    countedCash,
    difference: cashDifference(countedCash, expected),
    note: input.note?.trim() || null,
    userId: getUserId(),
    createdAt: f.existing?.createdAt ?? now,
    updatedAt: now,
    deletedAt: null,
  };
  await db().dayCloses.put(row);
  return row;
}
