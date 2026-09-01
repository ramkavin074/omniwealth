'use client';

import { useState, useEffect, useTransition } from 'react';
import { X, CheckCircle2, Wallet, CreditCard, Building2, Trash2 } from 'lucide-react';
import { updateAssetAction, deleteAssetAction } from '@/actions/vault';

interface EditAssetModalProps {
  asset: any;
  isOpen: boolean;
  onClose: () => void;
  legacyPillars: { name: string }[];
  canDelete?: boolean;
}

export default function EditAssetModal({ asset, isOpen, onClose, legacyPillars, canDelete = false }: EditAssetModalProps) {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [subRows, setSubRows] = useState<any[]>([]);
  const [singleValue, setSingleValue] = useState('');
  const [singleQty, setSingleQty] = useState('');
  const [singleCurrency, setSingleCurrency] = useState('USD');

  useEffect(() => {
    if (isOpen && asset) {
      // Diagnostic logs to inspect the exact object structure in your browser console (F12)
      console.log('EDIT ASSET:', asset);
      console.log('RAW ASSETS:', asset.rawAssets);

      if (asset.rawAssets && Array.isArray(asset.rawAssets) && asset.rawAssets.length > 0) {
        setSubRows(
          asset.rawAssets.map((r: any) => ({
            ...r,
            quantity:
              r.quantity ??
              r.qty ??
              r.shares ??
              r.totalQty ??
              r.totalQuantity ??
              r.holdingQty ??
              r.nativeQuantity ??
              ''
          }))
        );
      } else {
        setSubRows([
          {
            ...asset,
            quantity:
              asset.quantity ??
              asset.qty ??
              asset.shares ??
              asset.totalQty ??
              asset.totalQuantity ??
              asset.holdingQty ??
              asset.nativeQuantity ??
              ''
          }
        ]);
      }

      setSingleValue(asset.totalNative ?? asset.nativeValue ?? asset.value ?? '');
      setSingleQty(
        asset.totalQty ??
        asset.quantity ??
        asset.qty ??
        asset.shares ??
        asset.totalQuantity ??
        asset.holdingQty ??
        asset.nativeQuantity ??
        ''
      );
      setSingleCurrency(asset.nativeCurrency || asset.currency || 'USD');
    }
  }, [asset, isOpen]);

  if (!isOpen || !asset) return null;

  const isLiability = asset.assetType === 'LIABILITY' || asset.assetType === 'DEBT' || asset.accountCategory === 'LIABILITY';
  const isConsolidated = subRows.length > 1;

  async function handleDelete() {
    const ids: string[] = (isConsolidated ? subRows.map((r) => r.id) : [subRows[0]?.id || asset.id]).filter(Boolean);
    if (ids.length === 0) return;
    const label = isLiability ? 'liability' : 'asset';
    const msg = ids.length > 1
      ? `Delete this ${label} and all ${ids.length} underlying holdings? This cannot be undone.`
      : `Delete this ${label}? This cannot be undone.`;
    if (!confirm(msg)) return;

    setError('');
    startTransition(async () => {
      for (const id of ids) {
        const res = await deleteAssetAction(id);
        if (!res?.success) {
          setError(res?.error || 'Failed to delete item');
          return;
        }
      }
      onClose();
      window.location.reload();
    });
  }

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
        for (const row of subRows) {
          const rowFormData = new FormData();
          rowFormData.set('name', formData.get('name') as string);
          rowFormData.set('ticker', formData.get('ticker') as string || '');
          rowFormData.set('nativeValue', row.nativeValue?.toString() || '0');
          rowFormData.set('nativeCurrency', row.nativeCurrency || asset.nativeCurrency || 'USD');
          rowFormData.set('quantity', row.quantity?.toString() || '');
          rowFormData.set('rationale', formData.get('rationale') as string);
          rowFormData.set('assetType', asset.assetType || 'STOCK');
          rowFormData.set('accountCategory', row.accountCategory || 'INDIVIDUAL');
          rowFormData.set('accountNumber', row.accountNumber || 'DEFAULT');
          rowFormData.set('beneficiary', (formData.get('beneficiary') as string) || '');
          rowFormData.set('accessNotes', (formData.get('accessNotes') as string) || '');

          res = await updateAssetAction(row.id, rowFormData);
          if (!res?.success) break;
        }
      } else {
        formData.set('nativeValue', singleValue);
        formData.set('quantity', singleQty);
        formData.set('nativeCurrency', singleCurrency);

        const targetId = subRows[0]?.id || asset.id;
        res = await updateAssetAction(targetId, formData);
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
              Edit {isLiability ? 'Liability' : 'Asset'} {isConsolidated && `(Consolidated • ${subRows.length} Accounts)`}
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
                placeholder="e.g. NVDA"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold mb-1.5">
                Beneficiary <span className="normal-case font-normal text-slate-400">— optional</span>
              </label>
              <input
                name="beneficiary"
                defaultValue={asset.beneficiary || ''}
                placeholder="e.g. Spouse — Priya"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold mb-1.5">
                Access notes <span className="normal-case font-normal text-slate-400">— optional</span>
              </label>
              <input
                name="accessNotes"
                defaultValue={asset.accessNotes || ''}
                placeholder="Where the login / paperwork lives"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          {isConsolidated ? (
            <div className="space-y-3 pt-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Breakdown by Account &amp; Type ({subRows.length} holding source{subRows.length > 1 ? 's' : ''})
              </div>
              
              {subRows.map((row, idx) => (
                <div key={row.id || idx} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex flex-wrap justify-between items-center gap-2 text-[11px] text-slate-500 font-mono">
                    <span>Acc #: <strong className="text-slate-800 dark:text-slate-200">{row.accountNumber || 'DEFAULT'}</strong></span>
                    <span className="bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-900 px-2 py-0.5 rounded font-sans font-semibold">
                      Type: {row.accountCategory || 'INDIVIDUAL'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-1">Value ({row.nativeCurrency || asset.nativeCurrency})</label>
                      <input 
                        type="number"
                        step="any"
                        value={row.nativeValue ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSubRows(prev => prev.map((item, i) => i === idx ? { ...item, nativeValue: val } : item));
                        }}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase text-slate-400 mb-1">Quantity (Shares)</label>
                      <input 
                        type="number"
                        step="any"
                        value={row.quantity ?? ''}
                        onChange={(e) => {
                          const qty = e.target.value;
                          setSubRows(prev => prev.map((item, i) => i === idx ? { ...item, quantity: qty } : item));
                        }}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold mb-1.5">Total Value</label>
                <input 
                  type="number" 
                  step="any"
                  value={singleValue} 
                  onChange={(e) => setSingleValue(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-mono" 
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold mb-1.5">Currency</label>
                <select 
                  value={singleCurrency} 
                  onChange={(e) => setSingleCurrency(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-mono"
                >
                  {['USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold mb-1.5">Quantity / Shares</label>
                <input 
                  type="number" 
                  step="any"
                  value={singleQty} 
                  onChange={(e) => setSingleQty(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-mono" 
                />
              </div>
            </div>
          )}

          <div className="pt-4 flex items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800 mt-4">
            <div>
              {canDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="px-4 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition font-semibold disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition font-semibold cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={isPending} className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl transition font-semibold disabled:opacity-50 cursor-pointer">
                {isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}