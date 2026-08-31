'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { formatCompact } from '@/lib/format';

const STORAGE_KEY = 'omniwealth_concentration_dismissed';

// A single holding above this share of gross assets, or an asset class
// above the class threshold, is worth surfacing.
const SINGLE_ASSET_PCT = 25;
const ASSET_CLASS_PCT = 50;

function convert(
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

function classLabel(raw: string): string {
  const map: Record<string, string> = {
    REAL_ESTATE: 'Real estate',
    CRYPTO: 'Crypto',
    STOCK: 'Stocks',
    EQUITY: 'Equities',
    CASH: 'Cash',
    BOND: 'Bonds',
    MUTUAL_FUND: 'Mutual funds',
    ETF: 'ETFs',
    COMMODITY: 'Commodities',
  };
  return map[raw] || raw.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

type Flag = { key: string; label: string; pct: number; value: number };

export default function ConcentrationAlert({ assets = [], baseCurrency = 'USD', liveRates = {} }: any) {
  const flags = useMemo<Flag[]>(() => {
    const holdings: { name: string; cls: string; value: number }[] = [];
    for (const a of assets) {
      const type = (a.assetType || '').toUpperCase();
      const cat = (a.accountCategory || '').toUpperCase();
      if (type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY') continue;
      const raw = parseFloat(a.nativeValue || '0');
      const value = Math.abs(convert(raw, a.nativeCurrency || 'USD', baseCurrency, liveRates));
      if (value <= 0) continue;
      holdings.push({
        name: a.name || 'Unnamed holding',
        cls: type || cat || 'OTHER',
        value,
      });
    }

    const total = holdings.reduce((s, h) => s + h.value, 0);
    if (total <= 0 || holdings.length < 2) return [];

    const out: Flag[] = [];

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
  }, [assets, baseCurrency, liveRates]);

  // Signature changes when the flagged set or any share moves by ~5 points,
  // so a dismissed alert reappears if the picture materially shifts.
  const signature = useMemo(
    () => flags.map((f) => `${f.key}@${Math.round(f.pct / 5) * 5}`).join('|'),
    [flags],
  );

  const [dismissedSig, setDismissedSig] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  if (flags.length === 0 || signature === dismissedSig) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, signature);
    } catch {
      /* ignore */
    }
    setDismissedSig(signature);
  };

  return (
    <div className="border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl p-5 shadow-sm flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="p-2 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-xl shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0 space-y-1.5">
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">Concentration check</h4>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {flags.length === 1 ? 'One position is' : `${flags.length} positions are`} a large share
            of household assets:
          </p>
          <ul className="text-sm text-slate-700 dark:text-slate-200 space-y-0.5">
            {flags.map((f) => (
              <li key={f.key} className="flex items-baseline gap-2">
                <span className="font-mono font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                  {f.pct.toFixed(0)}%
                </span>
                <span className="truncate">{f.label}</span>
                <span className="text-slate-400 dark:text-slate-500 text-xs shrink-0">
                  {formatCompact(f.value, baseCurrency)} {baseCurrency}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <button
        onClick={dismiss}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-amber-100/60 dark:hover:bg-amber-900/30 cursor-pointer shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
