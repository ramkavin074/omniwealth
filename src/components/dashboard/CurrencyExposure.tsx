'use client';

import { useMemo } from 'react';
import { Globe } from 'lucide-react';
import { formatCompact } from '@/lib/format';

function convertCurrency(amount: number, from: string, to: string, rates: { [key: string]: number }): number {
  if (!from || !to || from === to) return amount;
  const rf = rates[from] || 1;
  const rt = rates[to] || 1;
  return (amount * rt) / rf;
}

// Cycled through in share order — no per-currency mapping needed.
const BARS = [
  'bg-teal-700',
  'bg-emerald-600',
  'bg-blue-600',
  'bg-indigo-600',
  'bg-amber-600',
  'bg-purple-600',
  'bg-rose-600',
  'bg-slate-500',
];

export default function CurrencyExposure({ assets = [], baseCurrency = 'USD', liveRates = {}, embedded = false }: any) {
  const { entries, total } = useMemo(() => {
    const map: { [ccy: string]: number } = {};
    for (const a of assets) {
      const type = (a.assetType || '').toUpperCase();
      const cat = (a.accountCategory || '').toUpperCase();
      if (type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY') continue;
      const ccy = (a.nativeCurrency || 'USD').toUpperCase();
      const val = Math.abs(
        convertCurrency(parseFloat(a.nativeValue || '0'), ccy, baseCurrency, liveRates),
      );
      if (val <= 0) continue;
      map[ccy] = (map[ccy] || 0) + val;
    }
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const sum = sorted.reduce((s, [, v]) => s + v, 0);
    return { entries: sorted, total: sum };
  }, [assets, baseCurrency, liveRates]);

  // Single-currency households don't need this card.
  if (entries.length < 2 || total <= 0) return null;

  return (
    <div className={embedded ? 'space-y-4' : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 print:border-slate-300 print:shadow-none'}>
      {!embedded && (
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <Globe className="w-5 h-5 text-slate-500 dark:text-slate-400 print:hidden" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Currency Exposure</h3>
        </div>
      )}

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Share of household assets held in each currency, valued in {baseCurrency}.
      </p>

      <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex border border-slate-200 dark:border-slate-700 shadow-inner">
        {entries.map(([ccy, val], i) => {
          const pct = (val / total) * 100;
          return (
            <div
              key={ccy}
              title={`${ccy}: ${pct.toFixed(1)}% (${formatCompact(val, baseCurrency)} ${baseCurrency})`}
              style={{ width: `${Math.max(pct, 2)}%` }}
              className={`${BARS[i % BARS.length]} transition-all duration-300`}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 pt-1">
        {entries.map(([ccy, val], i) => {
          const pct = (val / total) * 100;
          return (
            <div
              key={ccy}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col gap-1 shadow-sm min-w-0"
            >
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-3 h-3 rounded-full ${BARS[i % BARS.length]} shrink-0`} />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">{ccy}</span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono shrink-0">{pct.toFixed(1)}%</span>
              </div>
              <div className="font-mono text-sm text-slate-900 dark:text-white font-bold">
                {formatCompact(val, baseCurrency)} <span className="text-[10px] font-sans font-normal text-slate-500">{baseCurrency}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
