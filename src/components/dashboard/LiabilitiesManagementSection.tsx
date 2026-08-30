'use client';

import { CreditCard, Plus, Edit3, Trash2 } from 'lucide-react';
import { formatCompact } from '@/lib/format';
import { deleteAssetAction } from '@/actions/vault';
import { useTransition } from 'react';

const FX_RATES: { [key: string]: number } = {
  USD: 1, EUR: 1.08, GBP: 1.28, CAD: 0.74, AUD: 0.65, INR: 0.012, JPY: 0.0067, CHF: 1.12, CNY: 0.149,
};

function convertCurrency(amount: number, fromCurr: string, toCurr: string, rates: { [key: string]: number } = FX_RATES): number {
  if (fromCurr === toCurr) return amount;
  const rateFrom = rates[fromCurr] || 1;
  const rateTo = rates[toCurr] || 1;
  return (amount * rateTo) / rateFrom;
}

interface LiabilitiesManagementSectionProps {
  assets: any[];
  baseCurrency: string;
  liveRates?: { [key: string]: number };
  canAdd?: boolean;
  canManage?: boolean;
  onAddLiability: () => void;
  onEditAsset?: (asset: any) => void;
}

export default function LiabilitiesManagementSection({
  assets,
  baseCurrency,
  liveRates = FX_RATES,
  canAdd = true,
  canManage = true,
  onAddLiability,
  onEditAsset,
}: LiabilitiesManagementSectionProps) {
  const [isPending, startTransition] = useTransition();

  // Filter assets to find liabilities/debt
  const liabilities = assets.filter((a: any) => {
    const type = (a.assetType || '').toUpperCase();
    const cat = (a.accountCategory || '').toUpperCase();
    return type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY' || cat === 'DEBT';
  });

  const totalLiabilitiesBase = liabilities.reduce((sum, l) => {
    const val = parseFloat(l.nativeValue || '0');
    const converted = convertCurrency(val, l.nativeCurrency || 'USD', baseCurrency, liveRates);
    return sum + Math.abs(converted);
  }, 0);

  async function handleDelete(id: string) {
    if (confirm('Are you sure you want to delete this liability?')) {
      startTransition(async () => {
        await deleteAssetAction(id);
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400 font-bold font-mono">Total Outstanding Debt</div>
          <div className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">
            {formatCompact(totalLiabilitiesBase, baseCurrency)} <span className="text-base font-normal text-slate-500">{baseCurrency}</span>
          </div>
        </div>
        {canAdd && (
          <button
            onClick={onAddLiability}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Liability / Loan
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <CreditCard className="w-5 h-5 text-rose-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Active Liabilities &amp; Loans</h3>
        </div>

        {liabilities.length === 0 ? (
          <div className="text-center py-10 text-slate-500 dark:text-slate-400 text-xs">
            No liabilities recorded. Click &quot;Add Liability / Loan&quot; above to track mortgages, car loans, or personal debt.
          </div>
        ) : (
          <div className="space-y-3">
            {liabilities.map((item) => {
              const nativeVal = parseFloat(item.nativeValue || '0');
              const baseVal = convertCurrency(nativeVal, item.nativeCurrency || 'USD', baseCurrency, liveRates);

              return (
                <div key={item.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                      <span className="truncate">{item.name}</span>
                      <span className="text-[10px] uppercase font-mono bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900">
                        Liability
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Account Number: <span className="font-mono">{item.accountNumber || 'N/A'}</span> • Pillar: <span className="font-medium text-slate-700 dark:text-slate-300">{item.rationale || 'General'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    <div className="text-right font-mono">
                      <div className="font-bold text-slate-900 dark:text-white text-sm">
                        {formatCompact(baseVal, baseCurrency)} {baseCurrency}
                      </div>
                      {item.nativeCurrency !== baseCurrency && (
                        <div className="text-[10px] text-slate-500">
                          ({formatCompact(nativeVal, item.nativeCurrency)} {item.nativeCurrency})
                        </div>
                      )}
                    </div>

                    <div className={`flex items-center gap-1.5 pl-3 ${canManage ? 'border-l border-slate-200 dark:border-slate-800' : ''}`}>
                      {onEditAsset && (
                        <button
                          onClick={() => onEditAsset(item)}
                          className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-xl transition cursor-pointer"
                          title="Edit Liability"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      {canManage && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={isPending}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition cursor-pointer disabled:opacity-50"
                        title="Delete Liability"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}