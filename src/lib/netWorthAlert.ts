// Daily "how did my net worth change" push. Pure, so the cron and tests share
// one rule.

export const ALERT_MIN_BASE = 1000; // ignore tiny / empty households (base-currency units)
const FLAT_BELOW_PCT = 0.05; // moves that would display as "0.0%" aren't worth a push

export interface NetWorthMove {
  pct: number; // signed percent change
  direction: 'up' | 'down';
}

/**
 * The change since the previous snapshot, or null when there's nothing worth
 * saying (no usable baseline, or the number didn't really move — e.g. a
 * weekend with markets closed). No size threshold: any real move is reported.
 */
export function detectNetWorthMove(current: number, previous: number): NetWorthMove | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  // Percent change is only meaningful against a positive, non-trivial base.
  if (previous < ALERT_MIN_BASE) return null;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < FLAT_BELOW_PCT) return null;
  return { pct, direction: pct >= 0 ? 'up' : 'down' };
}

/** Percent-only copy: no amounts, since notifications show on the lock screen. */
export function netWorthAlertText(move: NetWorthMove): { title: string; body: string } {
  const abs = Math.abs(move.pct);
  const shown = abs >= 10 ? abs.toFixed(0) : abs.toFixed(1);
  return move.direction === 'up'
    ? { title: `Net worth up ${shown}%`, body: `Your household net worth rose ${shown}% since yesterday.` }
    : { title: `Net worth down ${shown}%`, body: `Your household net worth fell ${shown}% since yesterday.` };
}
