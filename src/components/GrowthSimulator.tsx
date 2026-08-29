'use client';

import { useState } from 'react';
import { Calculator } from 'lucide-react';

export default function GrowthSimulator({ currentTotalValue, baseCurrency }: { currentTotalValue: number; baseCurrency: string }) {
  const [returnRate, setReturnRate] = useState(7);
  const [inflationRate, setInflationRate] = useState(2.5);
  const [years, setYears] = useState(10);
  const [monthly, setMonthly] = useState(500);

  // Monthly nominal return rate compounding
  const r = returnRate / 100 / 12;
  const n = years * 12;
  
  // Nominal Future Value calculation
  const nominalFV = Math.round(
    currentTotalValue * Math.pow(1 + r, n) + 
    (r > 0 ? monthly * ((Math.pow(1 + r, n) - 1) / r) : monthly * n)
  );

  // Inflation-Adjusted Real Purchasing Power calculation
  const annualInflation = inflationRate / 100;
  const realFV = Math.round(nominalFV / Math.pow(1 + annualInflation, years));

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6 transition-colors">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <Calculator className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Future Wealth &amp; Inflation-Adjusted Simulation</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 shadow-sm">
          <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium">
            <span>Expected Return</span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{returnRate}%</span>
          </div>
          <input 
            type="range" 
            min="1" 
            max="20" 
            step="0.5" 
            value={returnRate} 
            onChange={(e) => setReturnRate(parseFloat(e.target.value))} 
            className="w-full accent-indigo-600 cursor-pointer" 
          />
        </div>

        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 shadow-sm">
          <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium">
            <span>Inflation Rate</span>
            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{inflationRate}%</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="10" 
            step="0.25" 
            value={inflationRate} 
            onChange={(e) => setInflationRate(parseFloat(e.target.value))} 
            className="w-full accent-rose-600 cursor-pointer" 
          />
        </div>

        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 shadow-sm">
          <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium">
            <span>Time Horizon</span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{years} Yrs</span>
          </div>
          <input 
            type="range" 
            min="1" 
            max="40" 
            value={years} 
            onChange={(e) => setYears(parseInt(e.target.value))} 
            className="w-full accent-indigo-600 cursor-pointer" 
          />
        </div>

        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1 shadow-sm flex flex-col justify-between">
          <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Monthly Addition</label>
          <input 
            type="number" 
            value={monthly} 
            onChange={(e) => setMonthly(parseFloat(e.target.value) || 0)} 
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500 shadow-sm" 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Nominal Projected Value</span>
          <div className="text-xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {nominalFV.toLocaleString()} <span className="text-xs font-sans text-indigo-600 dark:text-indigo-400">{baseCurrency}</span>
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Inflation-Adjusted (Real Purchasing Power)</span>
          <div className="text-xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
            {realFV.toLocaleString()} <span className="text-xs font-sans text-indigo-600 dark:text-indigo-400">{baseCurrency}</span>
          </div>
        </div>
      </div>
    </div>
  );
}