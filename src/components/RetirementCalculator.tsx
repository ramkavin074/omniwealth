'use client';

import { useState } from 'react';
import { Target, ShieldCheck, AlertCircle } from 'lucide-react';

interface CountryConfig {
  name: string;
  currency: string;
  symbol: string;
  defaultInflation: number;
  swr: number; // Safe Withdrawal Rate multiplier baseline
  defaultIncome: number;
  defaultContribution: number;
}

const COUNTRIES: { [key: string]: CountryConfig } = {
  US: { name: 'United States', currency: 'USD', symbol: '$', defaultInflation: 2.5, swr: 0.04, defaultIncome: 60000, defaultContribution: 1500 },
  UK: { name: 'United Kingdom', currency: 'GBP', symbol: '£', defaultInflation: 2.5, swr: 0.035, defaultIncome: 45000, defaultContribution: 1200 },
  EU: { name: 'Eurozone (Germany/France)', currency: 'EUR', symbol: '€', defaultInflation: 2.2, swr: 0.035, defaultIncome: 50000, defaultContribution: 1250 },
  India: { name: 'India', currency: 'INR', symbol: '₹', defaultInflation: 6.0, swr: 0.0325, defaultIncome: 1200000, defaultContribution: 25000 },
  Canada: { name: 'Canada', currency: 'CAD', symbol: 'CA$', defaultInflation: 2.3, swr: 0.04, defaultIncome: 75000, defaultContribution: 1800 },
  Australia: { name: 'Australia', currency: 'AUD', symbol: 'A$', defaultInflation: 2.8, swr: 0.0375, defaultIncome: 80000, defaultContribution: 2000 },
  Switzerland: { name: 'Switzerland', currency: 'CHF', symbol: 'CHF ', defaultInflation: 1.5, swr: 0.035, defaultIncome: 90000, defaultContribution: 2000 },
  Japan: { name: 'Japan', currency: 'JPY', symbol: '¥', defaultInflation: 1.2, swr: 0.03, defaultIncome: 6000000, defaultContribution: 100000 },
};

export default function RetirementCalculator({ currentTotalValue = 100000, baseCurrency = 'USD' }: { currentTotalValue?: number; baseCurrency?: string }) {
  const [selectedCountryKey, setSelectedCountryKey] = useState<string>('US');
  const country = COUNTRIES[selectedCountryKey] || COUNTRIES['US'];

  const [currentAge, setCurrentAge] = useState(35);
  const [retirementAge, setRetirementAge] = useState(65);
  const [currentSavings, setCurrentSavings] = useState(currentTotalValue);
  const [monthlyContribution, setMonthlyContribution] = useState(country.defaultContribution);
  const [returnRate, setReturnRate] = useState(7);
  const [desiredAnnualIncome, setDesiredAnnualIncome] = useState(country.defaultIncome);
  const [inflationRate, setInflationRate] = useState(country.defaultInflation);

  const handleCountryChange = (key: string) => {
    setSelectedCountryKey(key);
    const cfg = COUNTRIES[key];
    if (cfg) {
      setInflationRate(cfg.defaultInflation);
      setDesiredAnnualIncome(cfg.defaultIncome);
      setMonthlyContribution(cfg.defaultContribution);
    }
  };

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
  const targetNestEgg = desiredAnnualIncome / country.swr;
  const fundingPercentage = targetNestEgg > 0 ? Math.min(Math.round((projectedNestEgg / targetNestEgg) * 100), 250) : 0;
  const isFullyFunded = projectedNestEgg >= targetNestEgg;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-white uppercase">Retirement Readiness &amp; Regional SWR Simulator</h3>
        </div>
        
        {/* Country Dropdown Selector */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-medium">Region:</span>
          <select
            value={selectedCountryKey}
            onChange={(e) => handleCountryChange(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-indigo-300 font-mono font-bold focus:outline-none cursor-pointer"
          >
            {Object.entries(COUNTRIES).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.name} ({cfg.currency})
              </option>
            ))}
          </select>
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
          <label className="block text-slate-400 mb-1">Current Liquid Savings ({country.symbol})</label>
          <input 
            type="number" 
            value={currentSavings} 
            onChange={(e) => setCurrentSavings(parseFloat(e.target.value) || 0)} 
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-emerald-400 font-mono font-bold focus:outline-none focus:border-indigo-500" 
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Monthly Contribution ({country.symbol})</label>
          <input 
            type="number" 
            value={monthlyContribution} 
            onChange={(e) => setMonthlyContribution(parseFloat(e.target.value) || 0)} 
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono focus:outline-none focus:border-indigo-500" 
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Desired Annual Income ({country.symbol})</label>
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
              {country.symbol}{projectedNestEgg.toLocaleString()}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase text-slate-400 font-medium block">
              Target Capital Needed ({(country.swr * 100).toFixed(2)}% Rule)
            </span>
            <div className="text-2xl font-extrabold font-mono text-white mt-0.5">
              {country.symbol}{targetNestEgg.toLocaleString()}
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
              ? `Your family is fully on track under the ${country.name} economic parameters (${(country.swr * 100).toFixed(2)}% Safe Withdrawal Rate model).`
              : `Your family currently has a funding gap for the ${country.name} region. Adjusting your savings rate or target retirement age will help bridge the gap based on local inflation and market realities.`
            }
          </p>
        </div>
      </div>
    </div>
  );
}