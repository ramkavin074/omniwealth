'use client';

import { useMemo, useState } from 'react';
import { addAssetAction } from '@/actions/vault';
import { X } from 'lucide-react';
import { formatFull } from '@/lib/format';

// Asset types with a real per-unit market price — for these we ask for
// quantity + price and compute the total ourselves, so it's never ambiguous
// whether a number typed into "value" means the total or a single unit's
// price. Everything else (cash, real estate, PPF, pension...) has no
// meaningful "quantity", so it just asks for the total.
const QUANTIFIABLE_TYPES = new Set(['STOCK', 'CRYPTO', 'COMMODITY', 'MUTUAL_FUND']);

const TICKER_HINTS: Record<string, string> = {
  STOCK: 'e.g. AAPL — Indian exchanges: RELIANCE.NS (NSE) or TCS.BO (BSE)',
  CRYPTO: 'e.g. BTC, ETH, SOL',
  COMMODITY: 'Optional — leave blank for physical gold/silver you value manually',
  MUTUAL_FUND: "AMFI scheme code, e.g. 120503 — look it up at amfiindia.com or mfapi.in. Quantity = units held.",
};

export default function AddAssetModal({ legacyPillars, members, onClose, isLiability }: any) {
  const [assetType, setAssetType] = useState('STOCK');
  const [quantity, setQuantity] = useState('1');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [currency, setCurrency] = useState('USD');

  const isQuantifiable = !isLiability && QUANTIFIABLE_TYPES.has(assetType);

  const computedTotal = useMemo(() => {
    const qty = parseFloat(quantity);
    const price = parseFloat(pricePerUnit);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return null;
    return qty * price;
  }, [quantity, pricePerUnit]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs overflow-y-auto flex items-center justify-center p-4 print:hidden">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-xl my-auto text-slate-900 dark:text-white">
        <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{isLiability ? 'Add Liability / Debt' : 'Add Asset Manually'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <form action={async (fd) => {
          try {
            if (isLiability) {
              fd.set('assetType', 'LIABILITY');
              fd.set('accountCategory', 'LIABILITY');
            }
            if (isQuantifiable) {
              fd.set('quantity', quantity || '1');
              fd.set('nativeValue', String(computedTotal ?? 0));
            } else {
              fd.set('quantity', '1');
              fd.set('nativeValue', totalValue || '0');
            }
            fd.set('nativeCurrency', currency);
            await addAssetAction(fd);
            onClose();
          } catch (err) {
            console.error('Failed to add asset/liability:', err);
          }
        }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">{isLiability ? 'Liability Name' : 'Asset Name'}</label><input name="name" required placeholder={isLiability ? 'e.g. Mortgage' : 'e.g. Apple Stock'} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm" /></div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Ticker / Reference</label>
              <input name="ticker" placeholder="Optional" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-2.5 text-sm text-slate-900 dark:text-white font-mono shadow-sm" />
              {!isLiability && TICKER_HINTS[assetType] && (
                <p className="text-[10px] text-slate-400 mt-1">{TICKER_HINTS[assetType]}</p>
              )}
            </div>
          </div>
          {!isLiability && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Asset Type</label>
                <select name="assetType" value={assetType} onChange={(e) => setAssetType(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm">
                  <option value="STOCK">Stock</option>
                  <option value="MUTUAL_FUND">Mutual Fund</option>
                  <option value="CRYPTO">Crypto</option>
                  <option value="COMMODITY">Commodity / Gold</option>
                  <option value="CASH">Cash</option>
                  <option value="FIXED_INCOME">Fixed Income / PPF</option>
                  <option value="PENSION">Pension</option>
                  <option value="HSA">HSA</option>
                  <option value="REAL_ESTATE">Real Estate</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Account Category</label>
                <select name="accountCategory" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm">
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="IRA">Traditional IRA</option>
                  <option value="ROTH_IRA">Roth IRA</option>
                  <option value="401K">401(k)</option>
                  <option value="HSA">HSA</option>
                  <option value="PPF">PPF</option>
                  <option value="PF">PF / EPF</option>
                  <option value="PENSION">Pension</option>
                  <option value="SOCIAL_SECURITY">Social Security</option>
                  <option value="529">529 College</option>
                  <option value="TRUST">Trust</option>
                  <option value="REAL_ESTATE">Real Estate</option>
                </select>
              </div>
            </div>
          )}

          {isQuantifiable ? (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Quantity</label>
                  <input type="number" step="any" required value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-2.5 text-sm text-slate-900 dark:text-white font-mono shadow-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Price per unit</label>
                  <input type="number" step="any" required placeholder="e.g. 218" value={pricePerUnit} onChange={(e) => setPricePerUnit(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-2.5 text-sm text-slate-900 dark:text-white font-mono shadow-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Currency</label>
                  <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} required className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-2.5 text-sm text-slate-900 dark:text-white font-mono shadow-sm" />
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Total value:{' '}
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {computedTotal != null ? `${formatFull(computedTotal, currency)} ${currency}` : '—'}
                </span>{' '}
                (quantity × price — filled in automatically)
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">{isLiability ? 'Debt Amount' : 'Total Value'}</label>
                <input type="number" step="any" required placeholder="10000" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-2.5 text-sm text-slate-900 dark:text-white font-mono shadow-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Currency</label>
                <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} required className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-2.5 text-sm text-slate-900 dark:text-white font-mono shadow-sm" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Acct # (Last 4)</label><input name="accountNumber" defaultValue="DEFAULT" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-2.5 text-sm text-slate-900 dark:text-white font-mono shadow-sm" /></div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Owner</label>
              <select name="userId" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm">
                {members.map((m: any) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
              </select>
            </div>
          </div>
          {!isLiability && (
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Strategic Rationale &amp; Legacy Pillar</label>
              <select name="rationale" defaultValue={legacyPillars[0]?.name} required className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-2.5 text-sm text-slate-900 dark:text-white cursor-pointer shadow-sm">
                {legacyPillars.map((p: any) => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
          )}
          {!isLiability && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Beneficiary <span className="text-slate-400">(optional)</span></label>
                <input name="beneficiary" placeholder="e.g. Spouse — Priya" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Access notes <span className="text-slate-400">(optional)</span></label>
                <input name="accessNotes" placeholder="Where the login / paperwork lives" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-2.5 text-sm text-slate-900 dark:text-white shadow-sm" />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition">Cancel</button>
            <button type="submit" className={`px-4 py-2 text-white rounded-lg text-sm font-semibold cursor-pointer shadow-sm transition ${isLiability ? 'bg-rose-700 hover:bg-rose-800' : 'bg-teal-700 hover:bg-teal-800'}`}>
              {isLiability ? 'Save Liability' : 'Save Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
