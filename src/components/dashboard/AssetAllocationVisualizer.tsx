'use client';

import { useMemo } from 'react';
import { PieChart } from 'lucide-react';

// ... (keep the convertCurrency and formatAssetTypeName helper functions at the top exactly as they are) ...

export default function AssetAllocationVisualizer({ assets, baseCurrency, liveRates }: any) {
  // ... (keep the useMemo hook exactly as it is) ...

  const assetColors: { [key: string]: string } = {
    STOCK: 'bg-teal-700 hover:bg-teal-600', STOCKS: 'bg-teal-700 hover:bg-teal-600',
    ETF: 'bg-emerald-600 hover:bg-emerald-500', ETFS: 'bg-emerald-600 hover:bg-emerald-500',
    EQUITIES: 'bg-blue-600 hover:bg-blue-500', MUTUAL_FUND: 'bg-indigo-600 hover:bg-indigo-500',
    REAL_ESTATE: 'bg-amber-600 hover:bg-amber-500', CASH: 'bg-slate-700 hover:bg-slate-600',
    CRYPTO: 'bg-purple-600 hover:bg-purple-500', FIXED_INCOME: 'bg-teal-500 hover:bg-teal-400',
    PENSION: 'bg-rose-600 hover:bg-rose-500', COMMODITY: 'bg-yellow-600 hover:bg-yellow-500',
    OTHER: 'bg-slate-400 hover:bg-slate-300',
  };

  const positiveNetWorth = Math.max(totalNetWorth, 1);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 print:border-slate-300 print:shadow-none">
      {/* ... header ... */}
      
      <div className="space-y-4">
        {/* Restored Hover Tooltips to the Progress Bar */}
        <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex border border-slate-200 dark:border-slate-700 shadow-inner">
          {sortedEntries.map(([type, val]: [string, any]) => {
            const pct = ((val / positiveNetWorth) * 100).toFixed(1);
            const colorClass = assetColors[type] || 'bg-slate-500';
            return (
              <div 
                key={type} 
                title={`${formatAssetTypeName(type)}: ${pct}% (${Math.round(val).toLocaleString()} ${baseCurrency})`}
                style={{ width: `${Math.max(parseFloat(pct), 2)}%` }} 
                className={`${colorClass} transition-all duration-300 cursor-pointer`} 
              />
            );
          })}
        </div>
        
        {/* ... category cards ... */}
      </div>
    </div>
  );
}