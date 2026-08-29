'use client';

import { useState, useTransition } from 'react';
import { X, CheckCircle2, Wallet, CreditCard } from 'lucide-react';
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

  if (!isOpen || !asset) return null;

  const isLiability = asset.assetType === 'LIABILITY' || asset.assetType === 'DEBT' || asset.accountCategory === 'LIABILITY';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const formData = new FormData(e.currentTarget);
    
    // Ensure assetType and accountCategory are explicitly maintained if it's a liability
    if (isLiability) {
      formData.set('assetType', 'LIABILITY');
      formData.set('accountCategory', 'LIABILITY');
    }

    startTransition(async () => {
      const res = await updateAssetAction(asset.id, formData);
      if (res?.success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 800);
      } else {
        setError(res?.error || 'Failed to update item');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {isLiability ? (
              <CreditCard className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            ) : (
              <Wallet className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            )}
            <h2 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
              Edit {isLiability ? 'Liability' : 'Asset'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs sm:text-sm">
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

          <div>
            <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold mb-1.5">Name</label>
            <input 
              name="name" 
              defaultValue={asset.name} 
              required
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-teal-600" 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold mb-1.5">Value</label>
              <input 
                name="nativeValue" 
                type="number" 
                step="0.01"
                defaultValue={asset.nativeValue} 
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold mb-1.5">Quantity</label>
              <input 
                name="quantity" 
                type="number" 
                step="any"
                defaultValue={asset.quantity || '1'} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 font-mono" 
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold mb-1.5">Ticker Symbol</label>
              <input 
                name="ticker" 
                defaultValue={asset.ticker || ''} 
                placeholder="e.g. AAPL or XAU"
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

          <div className="pt-4 flex justify-end gap-2">
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