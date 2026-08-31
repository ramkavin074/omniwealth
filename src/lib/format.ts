// Currencies read in the Indian numbering system (lakh / crore).
const LAKH_CRORE = new Set(['INR', 'PKR', 'NPR', 'LKR', 'BDT']);

// Big units (M / B / L / Cr) always carry 2 decimals so amounts line up:
// 1.20M, 13.37 Cr, 4.50 L, 2.35B.
function big(x: number): string {
  return x.toFixed(2);
}

// K is a smaller magnitude — up to 1 decimal, trailing .0 dropped: 175.5K, 150K.
function small(x: number): string {
  return x.toFixed(1).replace(/\.0$/, '');
}

/**
 * Compact, human-readable form of a monetary amount.
 *   INR family        -> "13.37 Cr", "4.50 L"
 *   everything else    -> "2.35B", "1.20M", "175.5K"
 *   below the threshold -> full grouped number
 */
export function formatCompact(amount: number, currency = 'USD'): string {
  if (!Number.isFinite(amount)) return '0';
  const n = Math.abs(Math.round(amount));
  const sign = amount < 0 ? '-' : '';

  if (LAKH_CRORE.has(currency)) {
    if (n >= 1_00_00_000) return `${sign}${big(n / 1_00_00_000)} Cr`;
    if (n >= 1_00_000) return `${sign}${big(n / 1_00_000)} L`;
    return `${sign}${n.toLocaleString('en-IN')}`;
  }

  if (n >= 1_000_000_000) return `${sign}${big(n / 1_000_000_000)}B`;
  if (n >= 1_000_000) return `${sign}${big(n / 1_000_000)}M`;
  if (n >= 100_000) return `${sign}${small(n / 1_000)}K`;
  return `${sign}${n.toLocaleString('en-US')}`;
}

/**
 * Holding quantity for display. Whole/large counts round to 2 decimals
 * with grouping (100, 10.5, 12,345); sub-unit holdings (crypto) keep 4
 * significant figures so they don't collapse to 0 (0.00347, 0.0000123).
 */
export function formatQty(value: number | string): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(n) || n === 0) return '0';
  if (Math.abs(n) >= 1) {
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  return n.toLocaleString('en-US', { maximumSignificantDigits: 4 });
}

/** Full grouped number for tooltips / print, locale-aware. */
export function formatFull(amount: number, currency = 'USD'): string {
  if (!Number.isFinite(amount)) return '0';
  const locale = LAKH_CRORE.has(currency) ? 'en-IN' : 'en-US';
  return Math.round(amount).toLocaleString(locale);
}

/** True when the compact form actually differs from the full number. */
export function isCompacted(amount: number, currency = 'USD'): boolean {
  const n = Math.abs(amount);
  return LAKH_CRORE.has(currency) ? n >= 1_00_000 : n >= 100_000;
}
