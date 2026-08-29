'use client';

import { useMemo } from 'react';
import { deleteAssetAction } from '@/actions/vault';
import { CreditCard, Plus, Trash2 } from 'lucide-react';

const FX_RATES: { [key: string]: number } = { USD: 1, EUR: 1.08, GBP: 1.28, CAD: 0.74, AUD: 0.65, INR: 0.012, JPY: 0.0067, CHF: 1.12, CNY: 0.149 };
function convertCurrency(amount: number, fromCurr: string, toCurr: string, rates: { [key: string]: number } = FX_RATES): number {
  if (fromCurr === toCurr) return amount;
  return (amount * (rates[toCurr] || 1)) / (rates[fromCurr] || 1);
}

function formatCategoryName(cat: string): string {
  if (!cat) return 'Individual';
  const upper = cat.toUpperCase();
  if (upper === 'REAL_ESTATE') return 'Real Estate';
  if (upper === 'SOCIAL_SECURITY') return 'Social Security';
  if (upper === 'ROTH_IRA') return 'Roth IRA';
  if (upper === 'IRA') return 'Traditional IRA';
  if (upper === '401K') return '401(k)';
  return cat.replace(/_/g, ' ');
}

export default function LiabilitiesManagementSection({ assets, baseCurrency, liveRates = FX_RATES, onAddLiability }: any) {
  const { liabilities, totalLiabilities } = useMemo(() => {
    const list = assets.filter((a: any) => {
      const type = (a.assetType || '').toUpperCase();
      const cat = (a.accountCategory || '').toUpperCase();
      return type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY' || cat === 'DEBT';
    });
    const total = list.reduce((s: number, a: any) => {
      const val = parseFloat(a.nativeValue || '0');
      const baseVal = convertCurrency(val, a.nativeCurrency || 'USD', baseCurrency, liveRates);
      return s + Math.abs(baseVal);
    }, 0);
    return { liabilities: list, totalLiabilities: total };
  }, [assets, baseCurrency, liveRates]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-400 shrink-0 shadow-sm">
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">Liabilities &amp; Debt Tracking</h3>
            <p className="text-xs font-mono text-rose-700 dark:text-rose-400 font-bold mt-0.5">
              Total Debt: -{Math.round(totalLiabilities).toLocaleString()} {baseCurrency}
            </p>
          </div>
        </div>
        <button onClick={onAddLiability} className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs rounded-xl cursor-pointer shadow-sm transition shrink-0">
          <Plus className="w-4 h-4" /><span>Add Liability</span>
        </button>
      </div>

      <div className="space-y-3">
        {liabilities.map((item: any) => {
          const baseVal = convertCurrency(parseFloat(item.nativeValue || '0'), item.nativeCurrency || 'USD', baseCurrency, liveRates);
          return (
            <div key={item.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm min-w-0">
              <div className="min-w-0 pr-2">
                <div className="font-bold text-slate-900 dark:text-white text-sm break-words">{item.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Owner: {item.user?.fullName || 'Family Member'} | Category: {formatCategoryName(item.accountCategory)}
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-200 dark:border-slate-800">
                <span className="font-mono text-rose-700 dark:text-rose-400 font-bold text-sm">
                  -{Math.round(Math.abs(baseVal)).toLocaleString()} {baseCurrency}
                </span>
                <button onClick={async () => { await deleteAssetAction(item.id); window.location.reload(); }} className="text-slate-400 hover:text-rose-700 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}