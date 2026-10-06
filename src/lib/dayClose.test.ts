import { describe, expect, it } from 'vitest';
import { cashDifference, dayBounds, expectedCash } from './dayClose';

describe('day close', () => {
  it('adds cash in and takes cash out', () => {
    expect(
      expectedCash({ openingCash: 500, cashSales: 4200.5, cashReceived: 300, cashExpenses: 150.25, otherPaidOut: 1000 }),
    ).toBe(3850.25);
  });
  it('refunds reduce cash sales', () => {
    expect(expectedCash({ openingCash: 0, cashSales: 100 - 40, cashReceived: 0, cashExpenses: 0, otherPaidOut: 0 })).toBe(60);
  });
  it('reports short and over', () => {
    expect(cashDifference(990, 1000)).toBe(-10);
    expect(cashDifference(1005.5, 1000)).toBe(5.5);
    expect(cashDifference(1000, 1000)).toBe(0);
  });
  it('gives a 24h window for a local date, and null for junk', () => {
    const b = dayBounds('2026-10-05');
    expect(b).not.toBeNull();
    expect(b!.to - b!.from).toBeGreaterThanOrEqual(23 * 3_600_000);
    expect(b!.to - b!.from).toBeLessThanOrEqual(25 * 3_600_000);
    expect(dayBounds('nope')).toBeNull();
  });
});
