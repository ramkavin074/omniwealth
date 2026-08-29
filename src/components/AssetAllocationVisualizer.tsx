'use client';

import { useMemo } from 'react';
import { PieChart } from 'lucide-react';

function convertCurrency(amount: number, fromCurr: string, toCurr: string, rates: { [key: string]: number }): number {
  if (fromCurr === toCurr) return amount;
  const rateFrom = rates[fromCurr] || 1;
  const rateTo = rates[toCurr] || 1;
  return (amount * rateTo) / rateFrom;
}

function formatAssetTypeName(type: string): string {
  if (!type) return 'Other';
  const upper = type.toUpperCase().trim();
  if (upper === 'MUTUAL_FUND') return 'Mutual Funds';
  if (upper === 'REAL_ESTATE') return 'Real Estate';
  if (upper === 'FIXED_INCOME') return 'Fixed Income';
  if (upper === 'STOCK' || upper === 'STOCKS') return 'Stocks';
  if (upper === 'ETF' || upper === 'ETFS') return 'ETFs';
  if (upper === 'EQUITIES' || upper === 'EQUITY') return 'Equities';
  if (upper === 'CASH') return 'Cash';
  if (upper === 'CRYPTO') return 'Crypto';
  if (upper === 'PENSION') return 'Pension';
  if (upper === 'COMMODITY') return 'Commodity';
  return upper.replace(/_/g, ' ');
}

export default function AssetAllocationVisualizer({ assets, baseCurrency, liveRates }: any) {
  const { totalNetWorth, sortedEntries } = useMemo(() => {
    let netWorth = 0;
    const typeMap: { [key: string]: number } = {};
    
    assets.forEach((a: any) => {
      let t = (a.assetType || 'OTHER').toUpperCase().trim();
      if (t === 'LIABILITY' || t === 'DEBT') return;
      if (t === 'EQUITY') t = 'EQUITIES';
      const val = convertCurrency(parseFloat(a.nativeValue || '0'), a.nativeCurrency || 'USD', baseCurrency, liveRates);
      netWorth += Math.abs(val);
      typeMap[t] = (typeMap[t] || 0) + Math.abs(val);
    });

    const sorted = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);
    return { totalNetWorth: netWorth, sortedEntries: sorted };
  }, [assets, baseCurrency, liveRates]);
   
  const assetColors: { [key: string]: string } = {
    STOCK: 'bg-teal-700',
    STOCKS: 'bg-teal-700',
    ETF: 'bg-emerald-600',
    ETFS: 'bg-emerald-600',
    EQUITIES: 'bg-blue-600',
    MUTUAL_FUND: 'bg-indigo-600',
    REAL_ESTATE: 'bg-amber-600',
    CASH: 'bg-slate-700',
    CRYPTO: 'bg-purple-600',
    FIXED_INCOME: 'bg-teal-500',
    PENSION: 'bg-rose-600',
    COMMODITY: 'bg-yellow-600',
    OTHER: 'bg-slate-400',
  };

  const positiveNetWorth = Math.max(totalNetWorth, 1);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 print:border-slate-300 print:shadow-none">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <PieChart className="w-5 h-5 text-slate-500 dark:text-slate-400 print:hidden" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Asset Class Allocation</h3>
      </div>
      {sortedEntries.length === 0 ? (
        <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm">No assets available for allocation view.</div>
      ) : (
        <div className="space-y-4">
          <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex border border-slate-200 dark:border-slate-700 shadow-inner">
            {sortedEntries.map(([type, val]: [string, any]) => {
              const pct = (val / positiveNetWorth) * 100;
              const colorClass = assetColors[type] || 'bg-slate-500';
              return <div key={type} style={{ width: `${Math.max(pct, 2)}%` }} className={`${colorClass} transition-all duration-300`} />;
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 pt-2 print:grid-cols-3">
            {sortedEntries.map(([type, val]: [string, any]) => {
              const pct = positiveNetWorth > 0 ? ((val / positiveNetWorth) * 100).toFixed(1) : '0';
              const formattedName = formatAssetTypeName(type);
              const colorClass = assetColors[type] || 'bg-slate-500';
              return (
                <div key={type} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-1.5 shadow-sm min-w-0 print:border-slate-300 print:bg-white">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className={`w-3 h-3 rounded-full ${colorClass} shrink-0 mt-1`} />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase leading-snug break-words">{formattedName}</span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono shrink-0">{pct}%</span>
                  </div>
                  <div className="font-mono text-base sm:text-lg text-slate-900 dark:text-white font-bold mt-1">
                    {Math.round(val).toLocaleString()} <span className="text-xs font-sans font-normal text-slate-500">{baseCurrency}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}