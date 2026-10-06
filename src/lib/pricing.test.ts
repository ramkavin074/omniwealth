import { describe, expect, it } from 'vitest';
import { hasWholesale, schemeFreeQty, tierPrice } from './pricing';

describe('tierPrice', () => {
  it('uses the retail rate by default', () => {
    expect(tierPrice({ price: 50, wholesalePrice: 45 }, 'retail')).toBe(50);
  });
  it('uses the wholesale rate when set', () => {
    expect(tierPrice({ price: 50, wholesalePrice: 45 }, 'wholesale')).toBe(45);
  });
  it('falls back to retail when there is no wholesale rate', () => {
    expect(tierPrice({ price: 50 }, 'wholesale')).toBe(50);
    expect(tierPrice({ price: 50, wholesalePrice: 0 }, 'wholesale')).toBe(50);
  });
  it('falls back to MRP when the rate is blank', () => {
    expect(tierPrice({ price: 0, mrp: 60 }, 'retail')).toBe(60);
  });
  it('reports whether a product has a wholesale rate', () => {
    expect(hasWholesale({ wholesalePrice: 10 })).toBe(true);
    expect(hasWholesale({})).toBe(false);
  });
});

describe('schemeFreeQty', () => {
  it('gives free units per whole set bought', () => {
    expect(schemeFreeQty(10, 10, 1)).toBe(1);
    expect(schemeFreeQty(25, 10, 1)).toBe(2);
    expect(schemeFreeQty(9, 10, 1)).toBe(0);
    expect(schemeFreeQty(12, 6, 2)).toBe(4);
  });
  it('is zero without a scheme or quantity', () => {
    expect(schemeFreeQty(10, 0, 1)).toBe(0);
    expect(schemeFreeQty(10, 10, 0)).toBe(0);
    expect(schemeFreeQty(10, undefined, undefined)).toBe(0);
    expect(schemeFreeQty(0, 10, 1)).toBe(0);
  });
  it('handles decimal quantities', () => {
    expect(schemeFreeQty(2.5, 0.5, 0.1)).toBe(0.5);
  });
});
