import type { assets } from '@/db/schema';

type AssetRow = typeof assets.$inferSelect;

// Exchange rates are USD-based (units of `currency` per 1 USD), so the
// cross rate is amount * rateTo / rateFrom. Matches the dashboard hero.
export function convert(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): number {
  if (from === to) return amount;
  const rf = rates[from] || 1;
  const rt = rates[to] || 1;
  return (amount * rt) / rf;
}

// Sum of +|value| for assets and -|value| for liabilities, converted to
// the base currency. Mirrors UnifiedHeaderAndSummary's totalNetWorth.
export function netWorthOf(
  rows: AssetRow[],
  baseCurrency: string,
  rates: Record<string, number>,
): number {
  let total = 0;
  for (const a of rows) {
    const val = parseFloat(a.nativeValue || '0');
    const baseVal = convert(val, a.nativeCurrency || 'USD', baseCurrency, rates);
    const type = (a.assetType || '').toUpperCase();
    const rawCat = (a.accountCategory || 'INDIVIDUAL').toUpperCase();
    const isLiability =
      type === 'LIABILITY' || type === 'DEBT' || rawCat === 'LIABILITY';
    total += isLiability ? -Math.abs(baseVal) : Math.abs(baseVal);
  }
  return total;
}
