'use client';

import { useState, useTransition } from 'react';
import { Target, ShieldCheck, AlertCircle, Save, Check, TrendingUp, Calculator, ChevronDown } from 'lucide-react';
import { updateRetirementPreferencesAction } from '@/actions/vault';

interface CountryConfig {
  name: string;
  currency: string;
  symbol: string;
  defaultInflation: number;
  swr: number;
  defaultIncome: number;
  defaultContribution: number;
  // Rough all-in effective tax on employment income for a mid-career
  // earner — a starting point the user overrides, not a tax engine.
  defaultTaxRate: number;
  // Names of the local tax-advantaged buckets to fill first.
  taxAdvantaged: string;
}

const COUNTRIES: { [key: string]: CountryConfig } = {
  US: { name: 'United States', currency: 'USD', symbol: '$', defaultInflation: 2.5, swr: 0.04, defaultIncome: 60000, defaultContribution: 1500, defaultTaxRate: 22, taxAdvantaged: '401(k) / IRA / HSA' },
  UK: { name: 'United Kingdom', currency: 'GBP', symbol: '£', defaultInflation: 2.5, swr: 0.035, defaultIncome: 45000, defaultContribution: 1200, defaultTaxRate: 28, taxAdvantaged: 'workplace pension / SIPP / ISA' },
  EU: { name: 'Eurozone', currency: 'EUR', symbol: '€', defaultInflation: 2.2, swr: 0.035, defaultIncome: 50000, defaultContribution: 1250, defaultTaxRate: 35, taxAdvantaged: 'occupational pension / PEA-type accounts' },
  China: { name: 'China', currency: 'CNY', symbol: '¥', defaultInflation: 2.3, swr: 0.035, defaultIncome: 350000, defaultContribution: 8000, defaultTaxRate: 20, taxAdvantaged: 'enterprise annuity / private pension' },
  India: { name: 'India', currency: 'INR', symbol: '₹', defaultInflation: 6.0, swr: 0.0325, defaultIncome: 1200000, defaultContribution: 25000, defaultTaxRate: 20, taxAdvantaged: 'EPF / PPF / NPS' },
  Canada: { name: 'Canada', currency: 'CAD', symbol: 'CA$', defaultInflation: 2.3, swr: 0.04, defaultIncome: 75000, defaultContribution: 1800, defaultTaxRate: 25, taxAdvantaged: 'RRSP / TFSA' },
  Australia: { name: 'Australia', currency: 'AUD', symbol: 'A$', defaultInflation: 2.8, swr: 0.0375, defaultIncome: 80000, defaultContribution: 2000, defaultTaxRate: 30, taxAdvantaged: 'superannuation' },
  Switzerland: { name: 'Switzerland', currency: 'CHF', symbol: 'CHF ', defaultInflation: 1.5, swr: 0.035, defaultIncome: 90000, defaultContribution: 2000, defaultTaxRate: 22, taxAdvantaged: 'Pillar 2 / Pillar 3a' },
  Japan: { name: 'Japan', currency: 'JPY', symbol: '¥', defaultInflation: 1.2, swr: 0.03, defaultIncome: 6000000, defaultContribution: 100000, defaultTaxRate: 30, taxAdvantaged: 'iDeCo / NISA' },
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
  CNY: 0.149,
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
  const [additionalYears, setAdditionalYears] = useState<number>(0);

  // Required-savings planner (opt-in, collapsed by default).
  const [showPlanner, setShowPlanner] = useState(false);
  const [annualSalary, setAnnualSalary] = useState<number | ''>(country.defaultIncome);
  const [otherIncome, setOtherIncome] = useState<number | ''>(0);
  const [taxRate, setTaxRate] = useState<number | ''>(country.defaultTaxRate);
   
  const [isPending, startTransition] = useTransition();
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleCountryChange = (key: string) => {
    setSelectedCountryKey(key);
    const cfg = COUNTRIES[key];
    if (cfg) {
      setInflationRate(cfg.defaultInflation);
      setDesiredAnnualIncome(cfg.defaultIncome);
      setMonthlyContribution(cfg.defaultContribution);
      setAnnualSalary(cfg.defaultIncome);
      setTaxRate(cfg.defaultTaxRate);
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

  const cAge = currentAge === '' ? 0 : currentAge;
  const rAge = retirementAge === '' ? 0 : retirementAge;
  const cSavings = currentSavings === '' ? 0 : currentSavings;
  const mContrib = monthlyContribution === '' ? 0 : monthlyContribution;
  const rRate = returnRate === '' ? 0 : returnRate;
  const dIncome = desiredAnnualIncome === '' ? 0 : desiredAnnualIncome;

  const baseYearsToRetirement = Math.max(0, rAge - cAge);
  const totalYearsToRetirement = baseYearsToRetirement + additionalYears;
  const effectiveRetirementAge = rAge + additionalYears;

  const totalMonths = totalYearsToRetirement * 12;
  const monthlyRate = rRate / 100 / 12;

  const fvCurrent = cSavings * Math.pow(1 + monthlyRate, totalMonths);
  const fvContributions = monthlyRate > 0 
    ? mContrib * ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate)
    : mContrib * totalMonths;
   
  const projectedNestEgg = Math.round(fvCurrent + fvContributions);

  const targetNestEgg = dIncome / country.swr;
  const fundingPercentage = targetNestEgg > 0 ? Math.min(Math.round((projectedNestEgg / targetNestEgg) * 100), 250) : 0;
  const isFullyFunded = projectedNestEgg >= targetNestEgg;

  const surplusAmount = Math.max(0, projectedNestEgg - targetNestEgg);
  const surplusPercentage = targetNestEgg > 0 ? Math.min(Math.round((surplusAmount / targetNestEgg) * 100), 150) : 0;

  // --- Required-savings back-solve ---
  // What monthly contribution closes the gap between the target corpus and
  // what current savings alone grow to over the horizon?
  const sal = annualSalary === '' ? 0 : annualSalary;
  const other = otherIncome === '' ? 0 : otherIncome;
  const tax = taxRate === '' ? 0 : taxRate;
  const grossIncome = sal + other;
  const netIncome = Math.max(0, grossIncome * (1 - tax / 100));

  const gapToTarget = Math.max(0, targetNestEgg - fvCurrent);
  const requiredMonthly =
    gapToTarget <= 0
      ? 0
      : monthlyRate > 0
        ? (gapToTarget * monthlyRate) / (Math.pow(1 + monthlyRate, totalMonths) - 1)
        : gapToTarget / Math.max(totalMonths, 1);
  const requiredAnnual = requiredMonthly * 12;
  const savingsRateOfNet = netIncome > 0 ? (requiredAnnual / netIncome) * 100 : 0;
  const savingsRateOfGross = grossIncome > 0 ? (requiredAnnual / grossIncome) * 100 : 0;
  const planFeasible = requiredMonthly <= 0 || (savingsRateOfNet > 0 && savingsRateOfNet <= 50);

  // Age-based glidepath rule of thumb for the horizon length.
  const glide =
    totalYearsToRetirement > 20
      ? { eq: 80, bond: 15, cash: 5 }
      : totalYearsToRetirement >= 10
        ? { eq: 65, bond: 25, cash: 10 }
        : { eq: 50, bond: 35, cash: 15 };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6 transition-colors">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-teal-700 dark:text-teal-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Retirement Readiness &amp; Regional SWR Simulator</h3>
        </div>
         
        <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl shadow-sm">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-medium">Region:</span>
            <select
              value={selectedCountryKey}
              onChange={(e) => handleCountryChange(e.target.value)}
              className="bg-transparent border-0 text-xs text-teal-700 dark:text-teal-400 font-mono font-bold focus:outline-none cursor-pointer"
            >
              {Object.entries(COUNTRIES).map(([key, cfg]) => (
                <option key={key} value={key} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  {cfg.name} ({cfg.currency})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSavePreferences}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {savedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
            <span>{savedSuccess ? 'Saved!' : 'Save Targets'}</span>
          </button>
        </div>
      </div>

      {/* Grouped Input Section */}
      <div className="bg-slate-50/70 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide pb-2 border-b border-slate-200 dark:border-slate-800">
          Simulation Parameters
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Ages in a clean 2-column row */}
          <div className="space-y-1">
            <label className="block text-slate-500 dark:text-slate-400 font-medium">Current Age ({cAge} yrs)</label>
            <input 
              type="number" 
              value={currentAge} 
              onChange={(e) => setCurrentAge(e.target.value === '' ? '' : parseFloat(e.target.value))} 
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-teal-600 shadow-sm" 
            />
          </div>

          <div className="space-y-1">
            <label className="block text-slate-500 dark:text-slate-400 font-medium">Target Retirement Age ({rAge} yrs)</label>
            <input 
              type="number" 
              value={retirementAge} 
              onChange={(e) => setRetirementAge(e.target.value === '' ? '' : parseFloat(e.target.value))} 
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-teal-600 shadow-sm" 
            />
          </div>

          <div className="space-y-1">
            <label className="block text-slate-500 dark:text-slate-400 font-medium">Current Liquid Savings ({country.symbol})</label>
            <input 
              type="number" 
              value={currentSavings} 
              onChange={(e) => setCurrentSavings(e.target.value === '' ? '' : parseFloat(e.target.value))} 
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-teal-700 dark:text-teal-400 font-mono font-bold focus:outline-none focus:border-teal-600 shadow-sm" 
            />
          </div>

          <div className="space-y-1">
            <label className="block text-slate-500 dark:text-slate-400 font-medium">Monthly Contribution ({country.symbol})</label>
            <input 
              type="number" 
              value={monthlyContribution} 
              onChange={(e) => setMonthlyContribution(e.target.value === '' ? '' : parseFloat(e.target.value))} 
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-teal-600 shadow-sm" 
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="block text-slate-500 dark:text-slate-400 font-medium">Desired Annual Income ({country.symbol})</label>
            <input 
              type="number" 
              value={desiredAnnualIncome} 
              onChange={(e) => setDesiredAnnualIncome(e.target.value === '' ? '' : parseFloat(e.target.value))} 
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-teal-600 shadow-sm" 
            />
          </div>
        </div>

        {/* Stacked Sliders for Clean Mobile Spacing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-2 shadow-sm">
            <div className="flex justify-between text-slate-700 dark:text-slate-300 font-medium">
              <span>Expected Return</span>
              <span className="font-mono font-bold text-teal-700 dark:text-teal-400">{rRate}%</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="15" 
              step="0.5" 
              value={rRate} 
              onChange={(e) => setReturnRate(parseFloat(e.target.value))} 
              className="w-full accent-teal-700 cursor-pointer" 
              title="Return Rate"
            />
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-2 shadow-sm">
            <div className="flex justify-between text-slate-700 dark:text-slate-300 font-medium">
              <span>Inflation Rate</span>
              <span className="font-mono font-bold text-rose-700 dark:text-rose-400">{inflationRate}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="10" 
              step="0.5" 
              value={inflationRate === '' ? 0 : inflationRate} 
              onChange={(e) => setInflationRate(parseFloat(e.target.value))} 
              className="w-full accent-rose-700 cursor-pointer" 
              title="Inflation Rate"
            />
          </div>
        </div>

        {/* Horizon Slider */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Additional Future Simulation Horizon (+{additionalYears} Years)
            </label>
            <span className="text-xs font-mono font-bold text-teal-700 dark:text-teal-400">
              Retiring at Age {effectiveRetirementAge}
            </span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="20" 
            step="1" 
            value={additionalYears} 
            onChange={(e) => setAdditionalYears(parseInt(e.target.value) || 0)} 
            className="w-full accent-teal-700 cursor-pointer" 
            title="Additional Future Horizon Years"
          />
          <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            <span>0 yrs (At Target Age {rAge})</span>
            <span>+10 yrs</span>
            <span>+20 yrs (Age {rAge + 20})</span>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-5 shadow-sm">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide pb-2 border-b border-slate-200 dark:border-slate-800">
          Readiness &amp; Projections
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-semibold block">Projected Nest Egg at Age {effectiveRetirementAge}</span>
            <div className="text-2xl font-extrabold font-mono text-teal-700 dark:text-teal-400 mt-1">
              {country.symbol}{projectedNestEgg.toLocaleString()}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-semibold block">
              Target Capital Needed ({(country.swr * 100).toFixed(2)}% Rule)
            </span>
            <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white mt-1">
              {country.symbol}{targetNestEgg.toLocaleString()}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-semibold block">Readiness Status</span>
            <div className={`text-xl font-bold font-mono mt-1 ${fundingPercentage >= 100 ? 'text-emerald-700 dark:text-emerald-400' : 'text-teal-700 dark:text-teal-400'}`}>
              {fundingPercentage >= 100 ? '🎉 Goal Achieved!' : `🚀 ${100 - fundingPercentage}% away`}
            </div>
          </div>
        </div>

        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between text-[11px] font-mono text-slate-600 dark:text-slate-300 font-medium">
            <span>Retirement Target Funding Progress</span>
            <span>{fundingPercentage}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-300 dark:border-slate-700">
            <div 
              style={{ width: `${Math.min(fundingPercentage, 100)}%` }} 
              className={`h-full transition-all duration-500 ${fundingPercentage >= 100 ? 'bg-emerald-600' : 'bg-teal-700'}`}
            />
          </div>
        </div>

        {isFullyFunded && surplusAmount > 0 && (
          <div className="space-y-1.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex justify-between text-[11px] font-mono text-teal-800 dark:text-teal-300 font-medium">
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" /> Surplus / Generational Wealth Leftover (Beyond Target)
              </span>
              <span>{country.symbol}{surplusAmount.toLocaleString()}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-300 dark:border-slate-700">
              <div 
                style={{ width: `${Math.min(surplusPercentage, 100)}%` }} 
                className="h-full bg-teal-600 dark:bg-teal-500 transition-all duration-500"
              />
            </div>
          </div>
        )}

        <div className="flex items-start gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
          {isFullyFunded ? (
            <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
          )}
          <p className="leading-relaxed">
            {isFullyFunded
              ? `Your family is fully on track under the ${country.name} economic parameters. Delaying or extending your horizon by ${additionalYears} years brings your effective retirement age to ${effectiveRetirementAge}, yielding an excess surplus of ${country.symbol}${surplusAmount.toLocaleString()}.`
              : `Your family currently has a funding gap for the ${country.name} region. You are ${fundingPercentage}% funded toward your target lifestyle corpus.`
            }
          </p>
        </div>

        {/* Required-savings planner — opt-in, collapsed by default */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowPlanner((v) => !v)}
            className="flex items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wide cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5" />
            Plan my contributions
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPlanner ? 'rotate-180' : ''}`} />
          </button>

          {showPlanner && (
            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-slate-500 dark:text-slate-400 font-medium">Annual Salary, gross ({country.symbol})</label>
                  <input
                    type="number"
                    value={annualSalary}
                    onChange={(e) => setAnnualSalary(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-teal-600 shadow-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-500 dark:text-slate-400 font-medium">Other Annual Income — bonus, RSU ({country.symbol})</label>
                  <input
                    type="number"
                    value={otherIncome}
                    onChange={(e) => setOtherIncome(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-teal-600 shadow-sm"
                  />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-2 shadow-sm">
                <div className="flex justify-between text-slate-700 dark:text-slate-300 font-medium">
                  <span>Effective Tax Rate ({country.name})</span>
                  <span className="font-mono font-bold text-rose-700 dark:text-rose-400">{tax}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="55"
                  step="1"
                  value={taxRate === '' ? 0 : taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value))}
                  className="w-full accent-rose-700 cursor-pointer"
                  title="Effective tax rate"
                />
              </div>

              {grossIncome > 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-semibold block">
                        Save / Month to Hit Target by Age {effectiveRetirementAge}
                      </span>
                      <div className="text-2xl font-extrabold font-mono text-teal-700 dark:text-teal-400 mt-1">
                        {requiredMonthly <= 0
                          ? 'On track 🎉'
                          : `${country.symbol}${Math.round(requiredMonthly).toLocaleString()}`}
                      </div>
                      {requiredMonthly > 0 && (
                        <span className="text-[10px] text-slate-400">
                          {country.symbol}{Math.round(requiredAnnual).toLocaleString()}/yr
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-semibold block">Share of Take-Home Pay</span>
                      <div
                        className={`text-2xl font-extrabold font-mono mt-1 ${
                          planFeasible ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {requiredMonthly <= 0 ? '0%' : `${savingsRateOfNet.toFixed(0)}%`}
                      </div>
                      {requiredMonthly > 0 && (
                        <span className="text-[10px] text-slate-400">
                          {savingsRateOfGross.toFixed(0)}% of gross · take-home {country.symbol}
                          {Math.round(netIncome).toLocaleString()}/yr
                        </span>
                      )}
                    </div>
                  </div>

                  {requiredMonthly > 0 && (
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-semibold block mb-2">
                        A common {totalYearsToRetirement}-year-horizon mix (rule of thumb)
                      </span>
                      <div className="flex h-3 w-full rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div className="bg-teal-700" style={{ width: `${glide.eq}%` }} title={`Equities ${glide.eq}%`} />
                        <div className="bg-amber-600" style={{ width: `${glide.bond}%` }} title={`Fixed income ${glide.bond}%`} />
                        <div className="bg-slate-400" style={{ width: `${glide.cash}%` }} title={`Cash ${glide.cash}%`} />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1.5">
                        <span>Equities {glide.eq}%</span>
                        <span>Fixed income {glide.bond}%</span>
                        <span>Cash {glide.cash}%</span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                        Fill your {country.name} tax-advantaged accounts first ({country.taxAdvantaged}), then a taxable
                        brokerage. Simplified estimate in {country.currency} — not financial advice.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Enter your salary to see the required monthly saving.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}