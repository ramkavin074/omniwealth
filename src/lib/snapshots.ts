import { convert } from '@/lib/networth';

export interface SnapshotRow {
  date: string;
  currency: string;
  total: number;
}

const SPIKE_RATIO = 4;

const isSpike = (v: number, refs: number[]): boolean =>
  refs.every((r) => r > 0 && v > 0 && (v / r >= SPIKE_RATIO || r / v >= SPIKE_RATIO));

/**
 * Chart-ready history: every snapshot is expressed in the household's current
 * base currency (each row records the currency it was taken in, so switching
 * the base currency used to leave old points on a different scale), then
 * isolated one-off spikes — a point 4x+ away from BOTH neighbours while the
 * neighbours agree with each other — are dropped as bad data.
 */
export function normalizeSnapshots(
  rows: SnapshotRow[],
  baseCurrency: string,
  rates: Record<string, number>,
): { date: string; value: number }[] {
  const converted = rows
    .map((r) => ({
      date: r.date,
      value: Math.round(convert(r.total, r.currency || baseCurrency, baseCurrency, rates)),
    }))
    .filter((r) => Number.isFinite(r.value));

  return converted.filter((p, i, all) => {
    const prev = all[i - 1]?.value;
    const next = all[i + 1]?.value;
    const next2 = all[i + 2]?.value;
    const prev2 = all[i - 2]?.value;
    const agree = (a: number, b: number) => a > 0 && b > 0 && Math.max(a, b) / Math.min(a, b) < SPIKE_RATIO;
    if (prev !== undefined && next !== undefined) {
      return !(agree(prev, next) && isSpike(p.value, [prev, next]));
    }
    if (prev === undefined && next !== undefined && next2 !== undefined) {
      return !(agree(next, next2) && isSpike(p.value, [next, next2]));
    }
    if (next === undefined && prev !== undefined && prev2 !== undefined) {
      return !(agree(prev, prev2) && isSpike(p.value, [prev, prev2]));
    }
    return true;
  });
}
