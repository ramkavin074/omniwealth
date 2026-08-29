'use client';

import { useState, useTransition } from 'react';
import { X, CheckCircle2, Wallet, CreditCard, Building2 } from 'lucide-react';
import { updateAssetAction } from '@/actions/vault';

interface EditAssetModalProps {
  asset: any;
  isOpen: boolean;
  onClose: () => void;
  legacyPillars: { name: string }[];
}

export default function EditAssetModal({ asset, isOpen, onClose, legacyPillars }: EditAssetModalProps) {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Track editable state for multi-account rows if consolidated
  const isConsolidated = asset?.rawAssets && asset.rawAssets.length > 1;
  const [subRows, setSubRows] = useState<any[]>([]);

  // Initialize sub-rows when asset changes
  useState(() => {
    if (asset?.rawAssets) {
      setSubRows(asset.rawAssets.map((r: any) => ({ ...r })));
    }
  });

  if (!isOpen || !asset) return null;

  const isLiability = asset.assetType === 'LIABILITY' || asset.assetType === 'DEBT' || asset.accountCategory === 'LIABILITY';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const formData = new FormData(e.currentTarget);
    
    if (isLiability) {
      formData.set('assetType', 'LIABILITY');
      formData.set('accountCategory', 'LIABILITY');
    }

    startTransition(async () => {
      let res;
      if (isConsolidated) {
        // Update each underlying account row individually
        for (const row of subRows) {
          const rowFormData = new FormData();
          rowFormData.set('name', formData.get('name') as string);
          rowFormData.set('ticker', formData.get('ticker') as string || '');
          rowFormData.set('nativeValue', row.nativeValue.toString());
          rowFormData.set('nativeCurrency', row.nativeCurrency || asset.nativeCurrency);
          rowFormData.set('quantity', row.quantity?.toString() || '1');
          rowFormData.set('rationale', formData.get('rationale') as string);
          rowFormData.set('assetType', asset.assetType);
          rowFormData.set('accountCategory', row.accountCategory);
          rowFormData.set('accountNumber', row.accountNumber);

          res = await updateAssetAction(row.id, rowFormData);
          if (!res?.success) break;
        }
      } else {
        // Single asset update
        const primaryId = asset.rawAssets?.[0]?.id || asset.id;
        res = await updateAssetAction(primaryId, formData);
      }

      if (res?.success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
          window.location.reload();
        }, 800);
      } else {
        setError(res?.error || 'Failed to update item');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            {isLiability ? (
              <CreditCard className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            ) : (
              <Wallet className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            )}
            <h2 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
              Edit {isLiability ? 'Liability' : 'Asset'} {isConsolidated && '(Consolidated Accounts)'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs sm:text-sm overflow-y-auto flex-1">
          {success && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 p-3 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Successfully updated!
            </div>
          )}
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 p-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold mb-1.5">Asset / Holding Name</label>
              <input 
                name="name" 
                defaultValue={asset.name} 
                required
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-medium" 
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold mb-1.5">Ticker Symbol</label>
              <input 
                name="ticker" 
                defaultValue={asset.ticker || ''} 
                placeholder="e.g. AAPL"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-mono uppercase" 
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold mb-1.5">Legacy Pillar Assignment</label>
            <select 
              name="rationale" 
              defaultValue={asset.rationale} 
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
            >
              {legacyPillars.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* If consolidated across multiple accounts, show account-by-account breakdown */}
          {isConsolidated ? (
            <div className="space-y-3 pt-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Breakdown by Account ({subRows.length} accounts)
              </div>
              {subRows.map((row, idx) => (
                <div key={row.id || idx} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex justify-between items-center text-[11px] text-slate-500 font-mono">
                    <span>Account: <strong>{row.accountNumber || 'Default'}</strong></span>
                    <span className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">{row.accountCategory}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-1">Value ({row.nativeCurrency})</label>
                      <input 
                        type="number"
                        step="any"
                        value={row.nativeValue}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSubRows(prev => prev.map((item, i) => i === idx ? { ...item, nativeValue: val } : item));
                        }}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-1">Quantity</label>
                      <input 
                        type="number"
                        step="any"
                        value={row.quantity}
                        onChange={(e) => {
                          const qty = e.target.value;
                          setSubRows(prev => prev.map((item, i) => i === idx ? { ...item, quantity: qty } : item));
                        }}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Standard single asset inputs
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold mb-1.5">Value</label>
                <input 
                  name="nativeValue" 
                  type="number" 
                  step="any"
                  defaultValue={asset.totalNative ?? asset.nativeValue ?? '0'} 
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-mono" 
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold mb-1.5">Currency</label>
                <select 
                  name="nativeCurrency" 
                  defaultValue={asset.nativeCurrency || 'USD'} 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-mono"
                >
                  {['USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold mb-1.5">Quantity</label>
                <input 
                  name="quantity" 
                  type="number" 
                  step="any"
                  defaultValue={asset.totalQty ?? asset.quantity ?? '1'} 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-mono" 
                />
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition font-semibold cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl transition font-semibold disabled:opacity-50 cursor-pointer">
              {isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}