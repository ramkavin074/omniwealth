'use client';

import { useState } from 'react';
import { Calculator } from 'lucide-react';

export default function GrowthSimulator({ currentTotalValue }: { currentTotalValue: number }) {
  const [annualReturn, setAnnualReturn] = useState<number>(7);
  const [years, setYears] = useState<number>(10);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(500);

  // Compound interest calculation
  const calculateFutureValue = () => {
    const r = annualReturn / 100 / 12;
    const n = years * 12;
    const p = currentTotalValue;
    const c = monthlyContribution;

    const futureValueOfPrincipal = p * Math.pow(1 + r, n);
    const futureValueOfContributions = r > 0 ? c * ((Math.pow(1 + r, n) - 1) / r) : c * n;
    
    return Math.round(futureValueOfPrincipal + futureValueOfContributions);
  };

  const projectedValue = calculateFutureValue();
  const totalContributions = currentTotalValue + monthlyContribution * years * 12;
  const estimatedGain = projectedValue - totalContributions;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
        <Calculator className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Future Wealth &amp; Growth Simulation</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Expected Annual Return ({annualReturn}%)</label>
          <input
            type="range"
            min="1"
            max="20"
            step="0.5"
            value={annualReturn}
            onChange={(e) => setAnnualReturn(parseFloat(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Time Horizon ({years} Years)</label>
          <input
            type="range"
            min="1"
            max="40"
            step="1"
            value={years}
            onChange={(e) => setYears(parseInt(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Monthly Addition</label>
          <input
            type="number"
            value={monthlyContribution}
            onChange={(e) => setMonthlyContribution(parseFloat(e.target.value) || 0)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <div className="text-xs text-slate-400">Projected Portfolio Value in {years} Years</div>
          <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-0.5">
            ${projectedValue.toLocaleString()}
          </div>
        </div>
        <div className="text-right sm:text-right">
          <div className="text-xs text-slate-400">Estimated Compound Growth Gain</div>
          <div className="text-base font-bold font-mono text-indigo-300 mt-0.5">
            +${estimatedGain.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}