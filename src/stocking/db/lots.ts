// Reads lot (batch) information: what is on the shelf, with which expiry dates.
// See src/lib/lots.ts for the rules.

import { db } from './dexie';
import { lotsRemaining, nextExpiry, type LotEvent, type LotState } from '@/lib/lots';
import { daysUntil, type Product } from '../types';

export interface ProductLotInfo extends LotState {
  /** Earliest expiry among the stock actually on hand; null when none is tracked. */
  next: string | null;
  /** Whole days until `next` (negative = already past); null when `next` is null. */
  daysLeft: number | null;
  /** Units on the shelf that expire on `next`. */
  nextQty: number;
}

/**
 * Lot information for the given products.
 *
 * Only products that have ever received a lot-tagged stock-in need their history
 * replayed. They are found through an index on the tagged movements (so the cost
 * does not grow with the length of the ledger), and then only those products'
 * own movements are read. Everything else is simply "n units, with the date on
 * the product (if any)".
 */
export async function lotInfoFor(products: Product[]): Promise<Map<string, ProductLotInfo>> {
  const wanted = new Set(products.map((p) => p.id));
  const taggedMoves = await db().movements.where('expiryDate').above('').toArray();
  const withLots = new Set(taggedMoves.map((m) => m.productId).filter((id) => wanted.has(id)));

  const history = new Map<string, LotEvent[]>();
  for (const id of withLots) {
    const moves = await db().movements.where('productId').equals(id).toArray();
    history.set(
      id,
      moves.map((m) => ({ delta: m.delta, expiryDate: m.expiryDate ?? null, createdAt: m.createdAt })),
    );
  }

  const out = new Map<string, ProductLotInfo>();
  for (const p of products) {
    const state = lotsRemaining(history.get(p.id) ?? [], p.stockQty);
    const next = nextExpiry(state, p.expiryDate);
    const nextQty = next
      ? (state.untagged > 0 && p.expiryDate === next ? state.untagged : 0) +
        (state.lots.find((l) => l.expiryDate === next)?.qty ?? 0)
      : 0;
    out.set(p.id, { ...state, next, daysLeft: next ? daysUntil(next) : null, nextQty });
  }
  return out;
}
