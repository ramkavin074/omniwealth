import { describe, it, expect } from 'vitest';
import { normalizeSnapshots } from './snapshots';

const rates = { USD: 1, INR: 80 };
const row = (date: string, total: number, currency = 'USD') => ({ date, currency, total });

describe('normalizeSnapshots', () => {
  it('converts points recorded in another currency into the base currency', () => {
    const out = normalizeSnapshots([row('2026-09-03', 8_000_000, 'INR'), row('2026-10-01', 100_000)], 'USD', rates);
    expect(out.map((p) => p.value)).toEqual([100_000, 100_000]);
  });

  it('drops an isolated spike but keeps genuine trends', () => {
    const out = normalizeSnapshots(
      [row('a', 100), row('b', 105), row('c', 7200), row('d', 110), row('e', 115)],
      'USD',
      rates,
    );
    expect(out.map((p) => p.date)).toEqual(['a', 'b', 'd', 'e']);
  });

  it('drops a bad first or last point', () => {
    const out = normalizeSnapshots([row('a', 9000), row('b', 100), row('c', 102), row('d', 99), row('e', 9000)], 'USD', rates);
    expect(out.map((p) => p.date)).toEqual(['b', 'c', 'd']);
  });

  it('keeps a real sustained jump', () => {
    const out = normalizeSnapshots([row('a', 100), row('b', 110), row('c', 900), row('d', 950)], 'USD', rates);
    expect(out).toHaveLength(4);
  });
});
