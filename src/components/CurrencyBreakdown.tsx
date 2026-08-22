// src/components/CurrencyBreakdown.tsx
'use client';

import React from 'react';

interface Asset {
  id: string;
  nativeCurrency: string;
  baseValue: number;
}

const COLOR_MAP: Record<string, string> = {
  USD: 'bg-emerald-500',
  INR: 'bg-amber-500',
  EUR: 'bg-indigo-500',
  GBP: 'bg-purple-500',
  JPY: 'bg-rose-500',
  CAD: 'bg-cyan-500',
};

export default function CurrencyBreakdown({
  assets,
  baseCurrency,
}: {
  assets: Asset[];
  baseCurrency: string;
}) {
  const totalValue = assets.reduce((acc, curr) => acc + (curr.baseValue || 0), 0);

  if (totalValue === 0) return null;

  const currencyTotals = assets.reduce((acc, asset) => {
    const code = asset.nativeCurrency || 'USD';
    acc[code] = (acc[code] || 0) + (asset.baseValue || 0);
    return acc;
  }, {} as Record<string, number>);

  const breakdown = Object.entries(currencyTotals).map(([currency, value]) => ({
    currency,
    value,
    percentage: ((value / totalValue) * 100).toFixed(1),
  }));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Currency Exposure Breakdown ({baseCurrency})
        </h3>
        <span className="text-xs font-mono text-slate-500">{breakdown.length} Currencies Active</span>
      </div>

      {/* Stacked Progress Bar */}
      <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-slate-800">
        {breakdown.map((item) => (
          <div
            key={item.currency}
            style={{ width: `${item.percentage}%` }}
            className={`h-full ${COLOR_MAP[item.currency] || 'bg-slate-600'} transition-all duration-500`}
            title={`${item.currency}: ${item.percentage}%`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs font-mono">
        {breakdown.map((item) => (
          <div key={item.currency} className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${COLOR_MAP[item.currency] || 'bg-slate-600'}`} />
            <span className="font-semibold text-slate-200">{item.currency}</span>
            <span className="text-slate-400">{item.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}