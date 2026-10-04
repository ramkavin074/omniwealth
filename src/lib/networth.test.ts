import { describe, expect, it } from 'vitest';
import { countStaleHoldings, netWorthOf } from './networth';

const d = (daysAgo: number, now: number) => new Date(now - daysAgo * 86400000);

describe('netWorthOf', () => {
  it('adds assets, subtracts liabilities and converts currencies', () => {
    const rows = [
      { nativeValue: '100000', nativeCurrency: 'USD', assetType: 'STOCK', accountCategory: 'INDIVIDUAL' },
      { nativeValue: '8330000', nativeCurrency: 'INR', assetType: 'CASH', accountCategory: 'INDIVIDUAL' },
      { nativeValue: '20000', nativeCurrency: 'USD', assetType: 'LIABILITY', accountCategory: 'LIABILITY' },
    ] as any[];
    expect(Math.round(netWorthOf(rows, 'USD', { USD: 1, INR: 83.3 }))).toBe(180000);
  });
});

describe('countStaleHoldings', () => {
  const now = new Date('2026-10-04').getTime();
  const rows = [
    { userId: 'a', updatedAt: d(10, now) },
    { userId: 'a', updatedAt: d(120, now) },
    { userId: 'b', updatedAt: d(400, now) },
    { userId: 'a', updatedAt: null, createdAt: d(200, now) },
    { userId: 'a', updatedAt: null, createdAt: null },
  ] as any[];
  it('counts holdings older than 90 days, optionally for one owner', () => {
    expect(countStaleHoldings(rows, { now })).toBe(3);
    expect(countStaleHoldings(rows, { ownerId: 'a', now })).toBe(2);
    expect(countStaleHoldings(rows, { ownerId: 'c', now })).toBe(0);
  });
});
