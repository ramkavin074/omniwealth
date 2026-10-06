// Price tiers and "buy N get M free" schemes. Pure.

export type PriceMode = 'retail' | 'wholesale';

interface Priced {
  price: number;
  mrp?: number;
  wholesalePrice?: number;
}

/** Selling rate for a product under a price mode. Wholesale falls back to the
 *  retail rate when the product has no wholesale price. */
export function tierPrice(p: Priced, mode: PriceMode): number {
  if (mode === 'wholesale' && (p.wholesalePrice ?? 0) > 0) return p.wholesalePrice as number;
  return p.price || p.mrp || 0;
}

/** True when `p` has its own wholesale rate (so the toggle changes something). */
export function hasWholesale(p: Pick<Priced, 'wholesalePrice'>): boolean {
  return (p.wholesalePrice ?? 0) > 0;
}

/** Free units earned by buying `qty` under "buy `buy`, get `free` free".
 *  Only whole multiples of the buy quantity count: buy 10 get 1 free, bought 25 => 2. */
export function schemeFreeQty(qty: number, buy: number | undefined, free: number | undefined): number {
  const b = Number(buy) || 0;
  const f = Number(free) || 0;
  if (!(b > 0) || !(f > 0) || !(qty > 0)) return 0;
  const sets = Math.floor((Math.round(qty * 1000) / 1000) / b);
  return Math.round(sets * f * 1000) / 1000;
}
