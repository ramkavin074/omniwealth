'use client';

import { useState, useTransition } from 'react';
import { Target, ShieldCheck, AlertCircle, Save, Check } from 'lucide-react';
import { updateRetirementPreferencesAction } from '@/actions/vault';

interface CountryConfig {
  name: string;
  currency: string;
  symbol: string;
  defaultInflation: number;
  swr: number;
  defaultIncome: number;
  defaultContribution: number;
}

const COUNTRIES: { [key: string]: CountryConfig } = {
  US: { name: 'United States', currency: 'USD', symbol: '$', defaultInflation: 2.5, swr: 0.04, defaultIncome: 60000, defaultContribution: 1500 },
  UK: { name: 'United Kingdom', currency: 'GBP', symbol: '£', defaultInflation: 2.5, swr: 0.035, defaultIncome: 45000, defaultContribution: 1200 },
  EU: { name: 'Eurozone', currency: 'EUR', symbol: '€', defaultInflation: 2.2, swr: 0.035, defaultIncome: 50000, defaultContribution: 1250 },
  India: { name: 'India', currency: 'INR', symbol: '₹', defaultInflation: 6.0, swr: 0.0325, defaultIncome: 1200000, defaultContribution: 25000 },
  Canada: { name: 'Canada', currency: 'CAD', symbol: 'CA$', defaultInflation: 2.3, swr: 0.04, defaultIncome: 75000, defaultContribution: 1800 },
  Australia: { name: 'Australia', currency: 'AUD', symbol: 'A$', defaultInflation: 2.8, swr: 0.0375, defaultIncome: 80000, defaultContribution: 2000 },
  Switzerland: { name: 'Switzerland', currency: 'CHF', symbol: 'CHF ', defaultInflation: 1.5, swr: 0.035, defaultIncome: 90000, defaultContribution: 2000 },
  Japan: { name: 'Japan', currency: 'JPY', symbol: '¥', defaultInflation: 1.2, swr: 0.03, defaultIncome: 6000000, defaultContribution: 100000 },
};

const FX_RATES: { [key: string]: number } = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.28,
  CAD: 0.74,
  AUD: 0.65,
  INR: 0.012,
  JPY: 0.0067,
  CHF: 1.12,
};

function convertCurrency(amount: number, fromCurr: string, toCurr: string): number {
  if (fromCurr === toCurr) return amount;
  const rateFrom = FX_RATES[fromCurr] || 1;
  const rateTo = FX_RATES[toCurr] || 1;
  return (amount * rateFrom) / rateTo;
}

export default function RetirementCalculator({ 
  currentTotalValue = 100000, 
  baseCurrency = 'USD',
  initialCurrentAge = 35,
  initialRetirementAge = 65,
  initialDesiredIncome,
  initialCountry = 'US'
}: { 
  currentTotalValue?: number; 
  baseCurrency?: string;
  initialCurrentAge?: number;
  initialRetirementAge?: number;
  initialDesiredIncome?: number;
  initialCountry?: string;
}) {
  const [selectedCountryKey, setSelectedCountryKey] = useState<string>(initialCountry in COUNTRIES ? initialCountry : 'US');
  const country = COUNTRIES[selectedCountryKey] || COUNTRIES['US'];

  const convertedInitialSavings = Math.round(convertCurrency(currentTotalValue, baseCurrency, country.currency));

  const [currentAge, setCurrentAge] = useState<number | ''>(initialCurrentAge);
  const [retirementAge, setRetirementAge] = useState<number | ''>(initialRetirementAge);
  const [currentSavings, setCurrentSavings] = useState<number | ''>(convertedInitialSavings);
  const [monthlyContribution, setMonthlyContribution] = useState<number | ''>(country.defaultContribution);
  const [returnRate, setReturnRate] = useState<number | ''>(7);
  const [desiredAnnualIncome, setDesiredAnnualIncome] = useState<number | ''>(initialDesiredIncome ?? country.defaultIncome);
  const [inflationRate, setInflationRate] = useState<number | ''>(country.defaultInflation);
  
  const [isPending, startTransition] = useTransition();
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleCountryChange = (key: string) => {
    setSelectedCountryKey(key);
    const cfg = COUNTRIES[key];
    if (cfg) {
      setInflationRate(cfg.defaultInflation);
      setDesiredAnnualIncome(cfg.defaultIncome);
      setMonthlyContribution(cfg.defaultContribution);
      const newSavings = Math.round(convertCurrency(currentTotalValue, baseCurrency, cfg.currency));
      setCurrentSavings(newSavings);
    }
  };

  const handleSavePreferences = () => {
    if (currentAge === '' || retirementAge === '' || desiredAnnualIncome === '') return;
    startTransition(async () => {
      const res = await updateRetirementPreferencesAction({
        currentAge: Number(currentAge),
        retirementAge: Number(retirementAge),
        desiredIncome: Number(desiredAnnualIncome),
        country: selectedCountryKey,
      });
      if (res.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    });
  };

  // Calculations (fallback to 0 if empty)
  const cAge = currentAge === '' ? 0 : currentAge;
  const rAge = retirementAge === '' ? 0 : retirementAge;
  const cSavings = currentSavings === '' ? 0 : currentSavings;
  const mContrib = monthlyContribution === '' ? 0 : monthlyContribution;
  const rRate = returnRate === '' ? 0 : returnRate;
  const dIncome = desiredAnnualIncome === '' ? 0 : desiredAnnualIncome;

  const yearsToRetirement = Math.max(0, rAge - cAge);
  const totalMonths = yearsToRetirement * 12;
  const monthlyRate = rRate / 100 / 12;

  const fvCurrent = cSavings * Math.pow(1 + monthlyRate, totalMonths);
  const fvContributions = monthlyRate > 0 
    ? mContrib * ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate)
    : mContrib * totalMonths;
  
  const projectedNestEgg = Math.round(fvCurrent + fvContributions);

  const targetNestEgg = dIncome / country.swr;
  const fundingPercentage = targetNestEgg > 0 ? Math.min(Math.round((projectedNestEgg / targetNestEgg) * 100), 250) : 0;
  const isFullyFunded = projectedNestEgg >= targetNestEgg;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-white uppercase">Retirement Readiness &amp; Regional SWR Simulator</h3>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
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

          <button
            onClick={handleSavePreferences}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-md"
          >
            {savedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
            <span>{savedSuccess ? 'Saved!' : 'Save Targets'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        <div>
          <label className="block text-slate-400 mb-1">Current Age ({cAge} yrs)</label>
          <input 
            type="number" 
            value={currentAge} 
            onChange={(e) => setCurrentAge(e.target.value === '' ? '' : parseFloat(e.target.value))} 
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono focus:outline-none focus:border-indigo-500" 
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Target Retirement Age ({rAge} yrs)</label>
          <input 
            type="number" 
            value={retirementAge} 
            onChange={(e) => setRetirementAge(e.target.value === '' ? '' : parseFloat(e.target.value))} 
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono focus:outline-none focus:border-indigo-500" 
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Current Liquid Savings ({country.symbol})</label>
          <input 
            type="number" 
            value={currentSavings} 
            onChange={(e) => setCurrentSavings(e.target.value === '' ? '' : parseFloat(e.target.value))} 
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-emerald-400 font-mono font-bold focus:outline-none focus:border-indigo-500" 
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Monthly Contribution ({country.symbol})</label>
          <input 
            type="number" 
            value={monthlyContribution} 
            onChange={(e) => setMonthlyContribution(e.target.value === '' ? '' : parseFloat(e.target.value))} 
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono focus:outline-none focus:border-indigo-500" 
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Desired Annual Income ({country.symbol})</label>
          <input 
            type="number" 
            value={desiredAnnualIncome} 
            onChange={(e) => setDesiredAnnualIncome(e.target.value === '' ? '' : parseFloat(e.target.value))} 
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono focus:outline-none focus:border-indigo-500" 
          />
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Expected Return ({rRate}%) &amp; Inflation ({inflationRate}%)</label>
          <div className="flex gap-2 mt-1">
            <input 
              type="range" 
              min="1" 
              max="15" 
              step="0.5" 
              value={rRate} 
              onChange={(e) => setReturnRate(parseFloat(e.target.value))} 
              className="w-1/2 accent-indigo-500 cursor-pointer" 
              title="Return Rate"
            />
            <input 
              type="range" 
              min="0" 
              max="10" 
              step="0.5" 
              value={inflationRate === '' ? 0 : inflationRate} 
              onChange={(e) => setInflationRate(parseFloat(e.target.value))} 
              className="w-1/2 accent-rose-500 cursor-pointer" 
              title="Inflation Rate"
            />
          </div>
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-[10px] uppercase text-slate-400 font-medium block">Projected Nest Egg at Age {rAge}</span>
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
            <span className="text-[10px] uppercase text-slate-400 font-medium block">Readiness Status</span>
            <div className={`text-xl font-bold font-mono ${fundingPercentage >= 100 ? 'text-emerald-400' : 'text-indigo-400'}`}>
              {fundingPercentage >= 100 ? '🎉 Goal Achieved!' : `🚀 ${100 - fundingPercentage}% away`}
            </div>
          </div>
        </div>

        <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800">
          <div 
            style={{ width: `${Math.min(fundingPercentage, 100)}%` }} 
            className={`h-full transition-all duration-500 ${fundingPercentage >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-amber-500'}`}
          />
        </div>

        <div className="flex items-start gap-3 pt-2 text-xs text-slate-300">
          {isFullyFunded ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          )}
          <p>
            {isFullyFunded 
              ? `Your family is fully on track under the ${country.name} economic parameters (${(country.swr * 100).toFixed(2)}% Safe Withdrawal Rate model).`
              : `Your family currently has a funding gap for the ${country.name} region. You are ${fundingPercentage}% funded toward your target lifestyle corpus.`
            }
          </p>
        </div>
      </div>
    </div>
  );
}