'use client';

import { useMemo } from 'react';
import { deleteAssetAction } from '@/actions/vault';
import { CreditCard, Plus, Trash2 } from 'lucide-react';

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

export default function LiabilitiesManagementSection({ assets, baseCurrency, onAddLiability }: any) {
  const { liabilities, totalLiabilities } = useMemo(() => {
    const list = assets.filter((a: any) => {
      const type = (a.assetType || '').toUpperCase();
      const cat = (a.accountCategory || '').toUpperCase();
      return type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY' || cat === 'DEBT';
    });
    const total = list.reduce((s: number, a: any) => s + Math.abs(parseFloat(a.nativeValue || '0')), 0);
    return { liabilities: list, totalLiabilities: total };
  }, [assets]);

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
          <Plus className="w-4 h-4" />
          <span>Add Liability</span>
        </button>
      </div>

      {liabilities.length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-8 sm:p-10 text-center space-y-3 shadow-inner">
          <div className="text-slate-800 dark:text-slate-200 font-bold text-sm">No active liabilities logged yet</div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Log mortgages, cross-border loans, or credit lines using the button above to automatically subtract from your net worth in {baseCurrency}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {liabilities.map((item: any) => (
            <div key={item.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm min-w-0">
              <div className="min-w-0 pr-2">
                <div className="font-bold text-slate-900 dark:text-white text-sm break-words">{item.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Owner: {item.user?.fullName || 'Family Member'} | Category: {formatCategoryName(item.accountCategory)}
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-200 dark:border-slate-800">
                <span className="font-mono text-rose-700 dark:text-rose-400 font-bold text-sm">
                  -{Math.round(Math.abs(parseFloat(item.nativeValue || '0'))).toLocaleString()} {item.nativeCurrency || baseCurrency}
                </span>
                <button 
                  onClick={async () => { 
                    try {
                      await deleteAssetAction(item.id); 
                    } catch (err) {
                      console.error('Failed to delete liability:', err);
                    }
                  }} 
                  className="text-slate-400 hover:text-rose-700 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Delete Liability"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}