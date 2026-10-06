import { describe, expect, it } from 'vitest';
import { lotsRemaining, markdownPct, nextExpiry, type LotEvent } from './lots';

let t = 0;
const ev = (delta: number, expiryDate?: string): LotEvent => ({ delta, expiryDate: expiryDate ?? null, createdAt: ++t });
const reset = () => {
  t = 0;
};

describe('lotsRemaining', () => {
  it('keeps every lot when nothing has been sold', () => {
    reset();
    const r = lotsRemaining([ev(5, '2026-11-01'), ev(10, '2026-12-01')], 15);
    expect(r.lots).toEqual([{ expiryDate: '2026-11-01', qty: 5 }, { expiryDate: '2026-12-01', qty: 10 }]);
    expect(r.untagged).toBe(0);
  });

  it('sells the earliest expiry first', () => {
    reset();
    // received 5 (Nov) and 10 (Dec); sold 8 -> all 5 of Nov and 3 of Dec go
    const r = lotsRemaining([ev(5, '2026-11-01'), ev(10, '2026-12-01'), ev(-8)], 7);
    expect(r.lots).toEqual([{ expiryDate: '2026-12-01', qty: 7 }]);
  });

  it('sells stock without a lot date first (older stock)', () => {
    reset();
    // 10 older units, then a 20-unit lot; 12 sold -> the 10 older units and 2 of the lot
    const r = lotsRemaining([ev(10), ev(20, '2026-12-01'), ev(-12)], 18);
    expect(r.untagged).toBe(0);
    expect(r.lots).toEqual([{ expiryDate: '2026-12-01', qty: 18 }]);
    reset();
    expect(lotsRemaining([ev(10), ev(20, '2026-12-01'), ev(-5)], 25).untagged).toBe(5);
  });

  it('a lot received AFTER earlier sales is not used up by them', () => {
    reset();
    // The case that matters: older lot partly sold, then a new lot with an EARLIER date arrives.
    const r = lotsRemaining([ev(20, '2026-12-01'), ev(-3), ev(8, '2026-10-10')], 25);
    expect(r.lots).toEqual([{ expiryDate: '2026-10-10', qty: 8 }, { expiryDate: '2026-12-01', qty: 17 }]);
    expect(nextExpiry(r, null)).toBe('2026-10-10');
  });

  it('later sales take the new early lot first', () => {
    reset();
    const r = lotsRemaining([ev(20, '2026-12-01'), ev(-3), ev(8, '2026-10-10'), ev(-10)], 15);
    expect(r.lots).toEqual([{ expiryDate: '2026-12-01', qty: 15 }]);
  });

  it('undoing a receipt cancels exactly that lot', () => {
    reset();
    const r = lotsRemaining([ev(20, '2026-12-01'), ev(8, '2026-10-10'), ev(-8, '2026-10-10')], 20);
    expect(r.lots).toEqual([{ expiryDate: '2026-12-01', qty: 20 }]);
  });

  it('orders a same-instant receipt before a removal', () => {
    const r = lotsRemaining(
      [
        { delta: -3, expiryDate: null, createdAt: 5 },
        { delta: 10, expiryDate: '2026-12-01', createdAt: 5 },
      ],
      7,
    );
    expect(r.lots).toEqual([{ expiryDate: '2026-12-01', qty: 7 }]);
  });

  it('copes with empty, negative or unexplained stock', () => {
    reset();
    expect(lotsRemaining([], 7)).toEqual({ lots: [], untagged: 7 });
    expect(lotsRemaining([ev(10, '2026-12-01')], -3)).toEqual({ lots: [], untagged: 0 });
    // stock higher than the history explains -> the extra is plain older stock
    expect(lotsRemaining([ev(4, '2026-12-01')], 10)).toEqual({ lots: [{ expiryDate: '2026-12-01', qty: 4 }], untagged: 6 });
    // stock lower than the history explains (stock count correction) -> oldest units are written off
    reset();
    expect(lotsRemaining([ev(4, '2026-11-01'), ev(6, '2026-12-01')], 7).lots).toEqual([
      { expiryDate: '2026-11-01', qty: 1 },
      { expiryDate: '2026-12-01', qty: 6 },
    ]);
  });

  it('merges receipts with the same expiry date into one lot', () => {
    reset();
    expect(lotsRemaining([ev(4, '2026-12-01'), ev(6, '2026-12-01')], 10).lots).toEqual([{ expiryDate: '2026-12-01', qty: 10 }]);
  });
});

describe('nextExpiry', () => {
  it('returns the earliest date on the shelf, including older untagged stock', () => {
    expect(nextExpiry({ lots: [{ expiryDate: '2026-12-01', qty: 3 }], untagged: 0 }, '2026-10-20')).toBe('2026-12-01');
    expect(nextExpiry({ lots: [{ expiryDate: '2026-12-01', qty: 3 }], untagged: 2 }, '2026-10-20')).toBe('2026-10-20');
    expect(nextExpiry({ lots: [], untagged: 4 }, null)).toBeNull();
    expect(nextExpiry({ lots: [], untagged: 4 }, '2026-11-02')).toBe('2026-11-02');
  });
});

describe('markdownPct', () => {
  it('suggests bigger discounts as the date nears, none when expired or far off', () => {
    expect(markdownPct(2)).toBe(30);
    expect(markdownPct(6)).toBe(20);
    expect(markdownPct(12)).toBe(10);
    expect(markdownPct(30)).toBe(0);
    expect(markdownPct(-1)).toBe(0);
    expect(markdownPct(null)).toBe(0);
  });
});
