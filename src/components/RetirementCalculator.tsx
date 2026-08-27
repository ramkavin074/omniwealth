'use client';

import { useState } from 'react';
import { Target, ShieldCheck, AlertCircle } from 'lucide-react';

export default function RetirementCalculator({ currentTotalValue = 100000, baseCurrency = 'USD' }: { currentTotalValue?: number; baseCurrency?: string }) {
  const [country, setCountry] = useState<'US' | 'India'>('US');
  const [currentAge, setCurrentAge] = useState(35);
  const [retirementAge, setRetirementAge] = useState(65);
  const [currentSavings, setCurrentSavings] = useState(currentTotalValue);
  const [monthlyContribution, setMonthlyContribution] = useState(country === 'India' ? 25000 : 1500);
  const [returnRate, setReturnRate] = useState(7);
  const [desiredAnnualIncome, setDesiredAnnualIncome] = useState(country === 'India' ? 1200000 : 60000);
  
  // Region-specific defaults: US uses ~4% SWR, India uses ~3.25% SWR due to higher inflation
  const safeWithdrawalRate = country === 'US' ? 0.04 : 0.0325;
  const defaultInflation = country === 'US' ? 2.5 : 6.0;
  const [inflationRate, setInflationRate] = useState(defaultInflation);

  const handleCountryChange = (newCountry: 'US' | 'India') => {
    setCountry(newCountry);
    if (newCountry === 'India') {
      setInflationRate(6.0);
      setDesiredAnnualIncome(1200000); // 12 Lakhs INR
      setMonthlyContribution(25000);
    } else {
      setInflationRate(2.5);
      setDesiredAnnualIncome(60000); // 60k USD
      setMonthlyContribution(1500);
    }
  };

  const currencySymbol = country === 'US' ? '$' : '₹';

  // Calculations
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  const totalMonths = yearsToRetirement * 12;
  const monthlyRate = returnRate / 100 / 12;

  const fvCurrent = currentSavings * Math.pow(1 + monthlyRate, totalMonths);
  const fvContributions = monthlyRate > 0 
    ? monthlyContribution * ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate)
    : monthlyContribution * totalMonths;
  
  const projectedNestEgg = Math.round(fvCurrent + fvContributions);

  // Target Nest Egg based on regional Safe Withdrawal Rule
  const targetNestEgg = desiredAnnualIncome / safeWithdrawalRate;
  const fundingPercentage = targetNestEgg > 0 ? Math.min(Math.round((projectedNestEgg / targetNestEgg) * 100), 250) : 0;
  const isFullyFunded = projectedNestEgg >= targetNestEgg;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-white uppercase">Retirement Readiness &amp; Regional SWR Simulator</h3>
        </div>
        
        {/* Country Selector Toggle */}
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
          <button
            onClick={() => handleCountryChange('US')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              country === 'US' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            🇺🇸 United States (4% Rule)
          </button>
          <button
            onClick={() => handleCountryChange('India')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              country === 'India' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            🇮🇳 India (3%–3.5% Rule)
          </button>
        </div>
      </div>

      {/* Input Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        <div>
          <label className="block text-slate-400 mb-1">Current Age ({currentAge} yrs)</label>
          <input 
            type="number" 
            value={currentAge} 
            onChange={(e) => setCurrentAge(parseInt(e.target.value) || 0)} 
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono focus:outline-none focus:border-indigo-500" 
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Target Retirement Age ({retirementAge} yrs)</label>
          <input 
            type="number" 
            value={retirementAge} 
            onChange={(e) => setRetirementAge(parseInt(e.target.value) || 0)} 
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono focus:outline-none focus:border-indigo-500" 
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Current Liquid Savings ({currencySymbol})</label>
          <input 
            type="number" 
            value={currentSavings} 
            onChange={(e) => setCurrentSavings(parseFloat(e.target.value) || 0)} 
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-emerald-400 font-mono font-bold focus:outline-none focus:border-indigo-500" 
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Monthly Contribution ({currencySymbol})</label>
          <input 
            type="number" 
            value={monthlyContribution} 
            onChange={(e) => setMonthlyContribution(parseFloat(e.target.value) || 0)} 
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono focus:outline-none focus:border-indigo-500" 
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Desired Annual Income ({currencySymbol})</label>
          <input 
            type="number" 
            value={desiredAnnualIncome} 
            onChange={(e) => setDesiredAnnualIncome(parseFloat(e.target.value) || 0)} 
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono focus:outline-none focus:border-indigo-500" 
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Expected Return ({returnRate}%) &amp; Inflation ({inflationRate}%)</label>
          <div className="flex gap-2 mt-1">
            <input 
              type="range" 
              min="1" 
              max="15" 
              step="0.5" 
              value={returnRate} 
              onChange={(e) => setReturnRate(parseFloat(e.target.value))} 
              className="w-1/2 accent-indigo-500 cursor-pointer" 
              title="Return Rate"
            />
            <input 
              type="range" 
              min="0" 
              max="10" 
              step="0.5" 
              value={inflationRate} 
              onChange={(e) => setInflationRate(parseFloat(e.target.value))} 
              className="w-1/2 accent-rose-500 cursor-pointer" 
              title="Inflation Rate"
            />
          </div>
        </div>
      </div>

      {/* Results & Progress Breakdown */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-[10px] uppercase text-slate-400 font-medium block">Projected Nest Egg at Age {retirementAge}</span>
            <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-0.5">
              {currencySymbol}{projectedNestEgg.toLocaleString()}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase text-slate-400 font-medium block">
              Target Capital Needed ({country === 'US' ? '4% Rule / 25x' : '3.25% Rule / ~31x'})
            </span>
            <div className="text-2xl font-extrabold font-mono text-white mt-0.5">
              {currencySymbol}{targetNestEgg.toLocaleString()}
            </div>
          </div>
          <div className="text-left md:text-right">
            <span className="text-[10px] uppercase text-slate-400 font-medium block">Readiness Score</span>
            <div className={`text-xl font-bold font-mono ${fundingPercentage >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {fundingPercentage}% Funded
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800">
          <div 
            style={{ width: `${Math.min(fundingPercentage, 100)}%` }} 
            className={`h-full transition-all duration-500 ${fundingPercentage >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-amber-500'}`}
          />
        </div>

        {/* Verdict Box */}
        <div className="flex items-start gap-3 pt-2 text-xs text-slate-300">
          {isFullyFunded ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          )}
          <p>
            {isFullyFunded 
              ? `Your family is fully on track under the ${country === 'US' ? 'US 4% safe withdrawal model' : 'conservative Indian 3.25% SWR model (accounting for higher baseline inflation)'}.`
              : `Your family currently has a funding gap for the ${country} economic model. Because of India's higher historical CPI inflation (~6%), a safer withdrawal rate of ~3% to 3.25% requires a larger corpus multiplier (~30x–33x annual expenses) compared to the standard US 25x rule.`
            }
          </p>
        </div>
      </div>
    </div>
  );
}