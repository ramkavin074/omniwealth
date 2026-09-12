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

export interface ConcentrationFlag {
  key: string;
  label: string;
  pct: number;
  value: number;
}

function classLabel(raw: string): string {
  const map: Record<string, string> = {
    REAL_ESTATE: 'Real estate', CRYPTO: 'Crypto', STOCK: 'Stocks', EQUITY: 'Equities',
    CASH: 'Cash', BOND: 'Bonds', MUTUAL_FUND: 'Mutual funds', ETF: 'ETFs', COMMODITY: 'Commodities',
  };
  return map[raw] || raw.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

// A single holding above SINGLE_ASSET_PCT of gross assets, or an asset class
// above ASSET_CLASS_PCT, is worth surfacing. Shared by ConcentrationAlert
// (client, dashboard banner) and the weekly-digest cron (server, push).
const SINGLE_ASSET_PCT = 25;
const ASSET_CLASS_PCT = 50;

export function detectConcentrationFlags(
  rows: AssetRow[],
  baseCurrency: string,
  rates: Record<string, number>,
): ConcentrationFlag[] {
  const holdings: { name: string; cls: string; value: number }[] = [];
  for (const a of rows) {
    const type = (a.assetType || '').toUpperCase();
    const cat = (a.accountCategory || '').toUpperCase();
    if (type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY') continue;
    const raw = parseFloat(a.nativeValue || '0');
    const value = Math.abs(convert(raw, a.nativeCurrency || 'USD', baseCurrency, rates));
    if (value <= 0) continue;
    holdings.push({ name: a.name || 'Unnamed holding', cls: type || cat || 'OTHER', value });
  }

  const total = holdings.reduce((s, h) => s + h.value, 0);
  if (total <= 0 || holdings.length < 2) return [];

  const out: ConcentrationFlag[] = [];

  for (const h of holdings) {
    const pct = (h.value / total) * 100;
    if (pct >= SINGLE_ASSET_PCT) {
      out.push({ key: `asset:${h.name}`, label: h.name, pct, value: h.value });
    }
  }

  const byClass = new Map<string, number>();
  for (const h of holdings) byClass.set(h.cls, (byClass.get(h.cls) || 0) + h.value);
  for (const [cls, value] of byClass) {
    const pct = (value / total) * 100;
    if (pct >= ASSET_CLASS_PCT && byClass.size > 1) {
      out.push({ key: `class:${cls}`, label: `${classLabel(cls)} (all holdings)`, pct, value });
    }
  }

  return out.sort((a, b) => b.pct - a.pct);
}
