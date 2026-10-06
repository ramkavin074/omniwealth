// Day-close arithmetic: what the cash drawer should hold at the end of a day. Pure.

const q2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface CashParts {
  openingCash: number;
  cashSales: number; // cash taken on bills, net of refunds
  cashReceived: number; // cash customers paid against credit
  cashExpenses: number;
  otherPaidOut: number; // supplier payments in cash, owner withdrawals
}

export function expectedCash(p: CashParts): number {
  return q2(p.openingCash + p.cashSales + p.cashReceived - p.cashExpenses - p.otherPaidOut);
}

/** counted − expected: negative means the drawer is short. */
export function cashDifference(counted: number, expected: number): number {
  return q2(counted - expected);
}

/** [start, end) of a local 'YYYY-MM-DD' day in epoch ms; null if the date is malformed. */
export function dayBounds(date: string): { from: number; to: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const from = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  const to = new Date(+m[1], +m[2] - 1, +m[3] + 1).getTime();
  return Number.isFinite(from) ? { from, to } : null;
}
