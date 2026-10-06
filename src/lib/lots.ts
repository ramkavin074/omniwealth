// Lot (batch) tracking for expiry-first selling.
//
// A lot is stock received with its own expiry date. Lots are not stored as
// records of their own: they are derived by replaying a product's stock movements
// in time order. A stock-in that carries an expiry date adds to that lot, so they
// sync like any movement and two phones can never overwrite each other's lots.
//
// Shops sell the oldest stock first, so each sale takes
//   1. stock that has no lot date (older stock, or anything entered without one),
//   2. then lots in order of expiry date, earliest first,
// from what was on the shelf *at that moment* — a lot received later never "pays
// for" a sale that happened before it arrived.

export interface LotEvent {
  /** Signed change to stock. */
  delta: number;
  /** Lot expiry ('YYYY-MM-DD') carried by a stock-in, or by the movement that undid it. */
  expiryDate?: string | null;
  createdAt: number;
}

export interface Lot {
  expiryDate: string;
  /** Units of this lot still on the shelf. */
  qty: number;
}

export interface LotState {
  /** Lots still on the shelf, earliest expiry first. */
  lots: Lot[];
  /** Units on hand not covered by any lot (older stock without a lot date). */
  untagged: number;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Take `qty` units out of a state: untagged stock first, then the earliest lots. */
function consume(state: { untagged: number; lots: Map<string, number> }, qty: number): void {
  let left = qty;
  const takeUntagged = Math.min(state.untagged, left);
  state.untagged = round(state.untagged - takeUntagged);
  left = round(left - takeUntagged);
  if (left <= 0) return;
  for (const date of [...state.lots.keys()].sort()) {
    if (left <= 0) break;
    const have = state.lots.get(date) ?? 0;
    const take = Math.min(have, left);
    left = round(left - take);
    if (have - take > 0) state.lots.set(date, round(have - take));
    else state.lots.delete(date);
  }
  // Anything still left means the ledger went below zero; nothing more to take.
}

/**
 * What is on the shelf now, from the product's stock movements and its current
 * stock. `stock` is the source of truth for the total: if the replay disagrees
 * (for example history from before lots were tracked), the difference is treated
 * as untagged stock, or taken off the oldest units.
 */
export function lotsRemaining(events: LotEvent[], stock: number): LotState {
  const ordered = events
    .map((e, i) => ({ e, i }))
    // Equal timestamps: receipts before removals, so a same-instant pair behaves sensibly.
    .sort((a, b) => a.e.createdAt - b.e.createdAt || Number(b.e.delta > 0) - Number(a.e.delta > 0) || a.i - b.i)
    .map((x) => x.e);

  const state = { untagged: 0, lots: new Map<string, number>() };
  for (const ev of ordered) {
    if (ev.delta > 0) {
      if (ev.expiryDate) state.lots.set(ev.expiryDate, round((state.lots.get(ev.expiryDate) ?? 0) + ev.delta));
      else state.untagged = round(state.untagged + ev.delta);
    } else if (ev.delta < 0) {
      const qty = -ev.delta;
      if (ev.expiryDate) {
        // The receipt of this specific lot was undone.
        const have = state.lots.get(ev.expiryDate) ?? 0;
        const take = Math.min(have, qty);
        if (have - take > 0) state.lots.set(ev.expiryDate, round(have - take));
        else state.lots.delete(ev.expiryDate);
        if (qty > take) consume(state, round(qty - take));
      } else {
        consume(state, qty);
      }
    }
  }

  // Reconcile with the actual stock on hand.
  const onHand = Math.max(0, stock);
  const inLots = [...state.lots.values()].reduce((t, q) => t + q, 0);
  const replayTotal = round(state.untagged + inLots);
  if (replayTotal > onHand) consume(state, round(replayTotal - onHand));
  else if (replayTotal < onHand) state.untagged = round(state.untagged + (onHand - replayTotal));

  const lots: Lot[] = [...state.lots.entries()]
    .map(([expiryDate, qty]) => ({ expiryDate, qty }))
    .filter((l) => l.qty > 0)
    .sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : a.expiryDate > b.expiryDate ? 1 : 0));
  return { lots, untagged: Math.max(0, state.untagged) };
}

/** The date to watch: the earliest expiry among what is actually on the shelf. */
export function nextExpiry(state: LotState, legacyDate: string | null): string | null {
  const dates: string[] = state.lots.map((l) => l.expiryDate);
  if (state.untagged > 0 && legacyDate) dates.push(legacyDate);
  if (dates.length === 0) return null;
  return dates.sort()[0];
}

/**
 * Suggested markdown (percent off) for stock that is close to its date, so it
 * sells instead of being written off. Expired stock gets no markdown: it should
 * come off the shelf. Returns 0 when no markdown is suggested.
 */
export function markdownPct(daysLeft: number | null): number {
  if (daysLeft === null || daysLeft < 0) return 0;
  if (daysLeft <= 3) return 30;
  if (daysLeft <= 7) return 20;
  if (daysLeft <= 14) return 10;
  return 0;
}
