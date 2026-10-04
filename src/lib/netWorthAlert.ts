// Decides whether the day-over-day net-worth change is big enough to push.
// Pure, so the cron and tests share one rule.

export const ALERT_THRESHOLD_PCT = 3; // |change| of at least this much, in percent
export const ALERT_MIN_BASE = 1000; // ignore tiny / empty households (base-currency units)

export interface NetWorthMove {
  pct: number; // signed percent change
  direction: 'up' | 'down';
}

export function detectNetWorthMove(
  current: number,
  previous: number,
  thresholdPct = ALERT_THRESHOLD_PCT,
): NetWorthMove | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  // Percent change is only meaningful against a positive, non-trivial base.
  if (previous < ALERT_MIN_BASE) return null;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < thresholdPct) return null;
  return { pct, direction: pct >= 0 ? 'up' : 'down' };
}

/** Percent-only copy: no amounts, since notifications show on the lock screen. */
export function netWorthAlertText(move: NetWorthMove): { title: string; body: string } {
  const abs = Math.abs(move.pct);
  const shown = abs >= 10 ? abs.toFixed(0) : abs.toFixed(1);
  return move.direction === 'up'
    ? { title: 'Net worth is up', body: `Your household net worth rose ${shown}% since yesterday.` }
    : { title: 'Net worth is down', body: `Your household net worth fell ${shown}% since yesterday.` };
}
