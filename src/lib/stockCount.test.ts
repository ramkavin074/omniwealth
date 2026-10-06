import { describe, expect, it } from 'vitest';
import { summariseCount } from './stockCount';

const item = (id: string, system: number, counted: number | null, unitCost = 10) => ({
  id,
  name: id,
  system,
  counted,
  unitCost,
});

describe('summariseCount', () => {
  it('ignores items that were not counted', () => {
    const s = summariseCount([item('a', 5, null), item('b', 5, 5)]);
    expect(s.countedItems).toBe(1);
    expect(s.matched).toBe(1);
    expect(s.changed).toHaveLength(0);
  });

  it('totals shortages and excesses with their value', () => {
    const s = summariseCount([item('a', 10, 8, 20), item('b', 3, 5, 10), item('c', 4, 4)]);
    expect(s.countedItems).toBe(3);
    expect(s.matched).toBe(1);
    expect(s.shortageQty).toBe(2);
    expect(s.shortageValue).toBe(40);
    expect(s.excessQty).toBe(2);
    expect(s.excessValue).toBe(20);
    expect(s.changed.map((c) => c.id)).toEqual(['a', 'b']); // biggest loss first
  });

  it('handles decimal quantities without float noise', () => {
    const s = summariseCount([item('a', 1.1, 1.0, 100)]);
    expect(s.changed[0].diff).toBe(-0.1);
    expect(s.shortageValue).toBe(10);
  });

  it('counts zero as a real count (shelf is empty)', () => {
    const s = summariseCount([item('a', 4, 0, 5)]);
    expect(s.changed[0].diff).toBe(-4);
    expect(s.shortageValue).toBe(20);
  });

  it('ignores negative or non-numeric counts', () => {
    expect(summariseCount([item('a', 4, -1), item('b', 4, NaN)]).countedItems).toBe(0);
  });
});
