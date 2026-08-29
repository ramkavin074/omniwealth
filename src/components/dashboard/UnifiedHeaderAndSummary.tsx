'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { 
  updateHouseholdBaseCurrencyAction, 
  refreshLiveMarketPricesAction,
  fetchLiveExchangeRatesAction,
  logoutAction 
} from '@/actions/vault';
import { Plus, Sparkles, RefreshCw, Settings, Shield, LogOut, Coins, Wallet, CreditCard, FileText, Menu, Sun, Moon } from 'lucide-react';

const FX_RATES: { [key: string]: number } = {
  USD: 1, EUR: 1.08, GBP: 1.28, CAD: 0.74, AUD: 0.65, INR: 0.012, JPY: 0.0067, CHF: 1.12, CNY: 0.149,
};

function convertCurrency(amount: number, fromCurr: string, toCurr: string, rates: { [key: string]: number } = FX_RATES): number {
  if (fromCurr === toCurr) return amount;
  const rateFrom = rates[fromCurr] || 1;
  const rateTo = rates[toCurr] || 1;
  return (amount * rateTo) / rateFrom;
}

function formatCategoryName(cat: string): string {
  if (!cat) return 'Individual';
  const upper = cat.toUpperCase();
  if (upper === 'REAL_ESTATE') return 'Real Estate';
  if (upper === 'SOCIAL_SECURITY') return 'Social Security';
  if (upper === 'ROTH_IRA') return 'Roth IRA';
  if (upper === 'IRA') return 'Traditional IRA';
  if (upper === '401K') return '401(k)';
  if (upper === 'HSA') return 'HSA';
  if (upper === 'PPF') return 'PPF';
  if (upper === 'PF') return 'PF / EPF';
  if (upper === 'PENSION') return 'Pension';
  if (upper === '529') return '529 College';
  if (upper === 'TRUST') return 'Trust';
  if (upper === 'INDIVIDUAL') return 'Individual';
  return cat.replace(/_/g, ' ');
}

export default function UnifiedHeaderAndSummary({ session, initialAssets, baseCurrency, liveRates = FX_RATES, onOpenMenu, onOpenAddAsset, onOpenLiability, onOpenAiReader }: any) {
  const router = useRouter();
  const [isRefreshing, startRefreshTransition] = useTransition();

  const handleRefreshPrices = () => {
    startRefreshTransition(async () => {
      try {
        await refreshLiveMarketPricesAction();
        await fetchLiveExchangeRatesAction();
        router.refresh();
      } catch (err) {
        console.error('Failed to refresh live market prices:', err);
      }
    });
  };

  const householdTitle = session?.household?.name || 'Private Family';

  const categorySubtotals: { [key: string]: number } = {};
  let totalNetWorth = 0;

  initialAssets.forEach((a: any) => {
    const val = parseFloat(a.nativeValue || '0');
    const curr = a.nativeCurrency || 'USD';
    const baseVal = convertCurrency(val, curr, baseCurrency, liveRates);
    const type = (a.assetType || '').toUpperCase();
    const rawCat = a.accountCategory || 'INDIVIDUAL';
    const isLiability = type === 'LIABILITY' || type === 'DEBT' || rawCat === 'LIABILITY';
    const netVal = isLiability ? -Math.abs(baseVal) : Math.abs(baseVal);

    totalNetWorth += netVal;
    const label = ['IRA', 'ROTH_IRA', '401K'].includes(rawCat) ? 'Retirement' : rawCat;
    categorySubtotals[label] = (categorySubtotals[label] || 0) + netVal;
  });

  const sortedCategories = Object.entries(categorySubtotals).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200/85 dark:border-slate-800 sticky top-0 z-40 px-4 md:px-8 py-3.5 shadow-sm transition-colors print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center min-w-0 flex-1 max-w-[52%] sm:max-w-none">
            <button onClick={onOpenMenu} className="md:hidden p-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer hover:bg-slate-200 transition shrink-0" aria-label="Open Menu">
              <Menu className="w-5 h-5" />
            </button>
            <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group cursor-pointer min-w-0 flex-1">
              <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-sm">
                <Image src="/omniwealth.jpg" alt="OmniWealth" width={36} height={36} className="object-cover w-full h-full" />
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="font-bold text-[10px] sm:text-xs md:text-base tracking-tight break-words text-slate-900 dark:text-white">
                  Family Wealth Hub
                </div>
                <div className="text-[8px] sm:text-[10px] md:text-xs uppercase tracking-wide text-teal-700 dark:text-teal-400 font-semibold font-mono break-words">
                  {householdTitle}
                </div>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 max-w-[48%] sm:max-w-none">
            <CurrencySwitcherForm currentCurrency={baseCurrency} />
             
            <div className="hidden md:flex items-center gap-2">
              <button onClick={onOpenAddAsset} className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm rounded-xl transition cursor-pointer shadow-sm">
                <Plus className="w-4 h-4" /><span>Add Asset</span>
              </button>
              <button onClick={onOpenLiability} className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white font-semibold text-sm rounded-xl transition cursor-pointer shadow-sm">
                <CreditCard className="w-4 h-4" /><span>Add Liability</span>
              </button>
              <button onClick={onOpenAiReader} className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 dark:bg-slate-800 text-white border border-slate-800 dark:border-slate-700 font-semibold text-sm rounded-xl transition cursor-pointer shadow-sm">
                <Sparkles className="w-4 h-4 text-amber-400" /><span>AI Reader</span>
              </button>
              <button onClick={() => window.print()} title="Export Report / Save as PDF" className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-sm">
                <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </button>
              <button onClick={handleRefreshPrices} disabled={isRefreshing} title="Refresh Live Market Prices" className="p-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-50 shadow-sm">
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <Link href="/profile" title="Household Settings" className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-sm">
                <Settings className="w-4 h-4" />
              </Link>

              {/* Super Admin Portal Button (Visible only for SUPER_ADMIN role) */}
              {session?.user?.role === 'SUPER_ADMIN' && (
                <Link href="/admin" title="Super Admin Portal" className="p-2 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-xl border border-purple-200 dark:border-purple-900 transition cursor-pointer shadow-sm">
                  <Shield className="w-4 h-4" />
                </Link>
              )}

              <ThemeToggleButton />

              <form action={logoutAction}>
                <button type="submit" title="Logout" className="p-2 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-900 transition cursor-pointer shadow-sm">
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Clean Mobile Net Worth Card without extraneous floating buttons */}
      <div className="block md:hidden px-4 pt-4 print:hidden">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold block">Global Net Worth</span>
          <div className="text-xl font-black font-mono text-teal-700 dark:text-teal-400 truncate mt-0.5">
            {Math.round(totalNetWorth).toLocaleString()} <span className="text-xs font-sans font-normal text-teal-600">{baseCurrency}</span>
          </div>
        </div>
      </div>

      <div className="hidden md:block max-w-7xl mx-auto px-4 md:px-8 pt-2">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 print:border-none print:shadow-none print:p-0">
          <div className="shrink-0">
            <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-slate-400 print:hidden" /> Global Household Net Worth
            </span>
            <div className="text-4xl font-extrabold font-mono text-teal-700 dark:text-teal-400 mt-1">
              {Math.round(totalNetWorth).toLocaleString()} <span className="text-teal-600 dark:text-teal-500 text-lg font-sans">{baseCurrency}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 w-full lg:w-auto flex-1 max-w-4xl print:grid-cols-3">
            {sortedCategories.map(([cat, val]) => (
              <div key={cat} className="bg-slate-50/70 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 px-4 py-3 rounded-xl text-xs shadow-sm min-w-0 print:border-slate-300 print:bg-white">
                <span className="text-slate-500 dark:text-slate-400 uppercase text-[10px] block font-medium truncate">{formatCategoryName(cat)}</span>
                <span className={`font-mono font-bold text-sm block truncate mt-0.5 ${val < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                  {Math.round(val).toLocaleString()} <span className="text-[11px] font-sans font-normal text-slate-500">{baseCurrency}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ThemeToggleButton() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark') || 
      localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
     
    setIsDark(isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <button
      onClick={toggleTheme}
      title="Toggle Light/Dark Theme"
      className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-sm flex items-center gap-1.5 text-xs font-semibold"
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-slate-600" />
      )}
    </button>
  );
}

function CurrencySwitcherForm({ currentCurrency }: { currentCurrency: string }) {
  const router = useRouter();
  const [selectedCurrency, setSelectedCurrency] = useState(currentCurrency);
  const [isPending, startTransition] = useTransition();

  const handleCurrencyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCurrency = e.target.value;
    setSelectedCurrency(newCurrency);
    startTransition(async () => {
      try {
        await updateHouseholdBaseCurrencyAction(newCurrency);
        router.refresh();
      } catch (err) {
        console.error('Failed to update base currency:', err);
      }
    });
  };

  return (
    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-1.5 rounded-xl shrink-0 shadow-sm">
      <Coins className="w-4 h-4 text-slate-500 dark:text-slate-400" />
      <select value={selectedCurrency} onChange={handleCurrencyChange} disabled={isPending} className="bg-transparent border-0 text-xs text-slate-800 dark:text-slate-200 font-mono font-bold focus:outline-none cursor-pointer disabled:opacity-50">
        {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'CHF', 'CNY'].map((c) => (
          <option key={c} value={c} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{c}</option>
        ))}
      </select>
    </div>
  );
}