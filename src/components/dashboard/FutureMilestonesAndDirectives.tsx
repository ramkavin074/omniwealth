'use client';

import { useState } from 'react';
import { Shield, Edit3, Check } from 'lucide-react';
import { formatCompact } from '@/lib/format';

export default function FutureMilestonesAndDirectives({ assets }: any) {
  const ssnAssets = assets.filter((a: any) => a.accountCategory === 'SOCIAL_SECURITY');
  const pensionAssets = assets.filter((a: any) => a.accountCategory === 'PENSION' || a.assetType === 'PENSION');
  const ppfAssets = assets.filter((a: any) => a.accountCategory === 'PPF');
  const [customData, setCustomData] = useState<{ [key: string]: { amount: number; instruction: string; editing: boolean } }>({});

  if (ssnAssets.length === 0 && pensionAssets.length === 0 && ppfAssets.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <Shield className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Future Income Milestones &amp; Family Directives</h3>
        </div>
        <div className="text-center py-8 text-sm text-slate-500 dark:text-slate-400">
          No pension, provident fund, or social security assets logged yet. Add them to view milestones.
        </div>
      </div>
    );
  }

  const getDefaultInstruction = (category: string) => {
    if (category === 'SOCIAL_SECURITY') return 'Sovereign monthly pension stream tracked separately. Excluded from liquid net worth.';
    if (category === 'PENSION') return 'Guaranteed monthly pension tier claimable upon reaching maturity.';
    return 'Family Claiming Instruction: Submit forms at the designated branch upon maturity.';
  };

  const getAmount = (asset: any) => customData[asset.id]?.amount !== undefined ? customData[asset.id].amount : parseFloat(asset.nativeValue || '0');
  const getInstruction = (asset: any) => customData[asset.id]?.instruction !== undefined ? customData[asset.id].instruction : getDefaultInstruction(asset.accountCategory);
  const isEditing = (assetId: string) => customData[assetId]?.editing || false;

  const setEditing = (assetId: string, editing: boolean) => {
    setCustomData(prev => ({
      ...prev,
      [assetId]: {
        amount: prev[assetId]?.amount ?? parseFloat(assets.find((a: any) => a.id === assetId)?.nativeValue || '0'),
        instruction: prev[assetId]?.instruction ?? getDefaultInstruction(assets.find((a: any) => a.id === assetId)?.accountCategory),
        editing
      }
    }));
  };

  const updateField = (assetId: string, field: 'amount' | 'instruction', value: any) => {
    setCustomData(prev => ({
      ...prev,
      [assetId]: {
        amount: field === 'amount' ? value : (prev[assetId]?.amount ?? parseFloat(assets.find((a: any) => a.id === assetId)?.nativeValue || '0')),
        instruction: field === 'instruction' ? value : (prev[assetId]?.instruction ?? getDefaultInstruction(assets.find((a: any) => a.id === assetId)?.accountCategory)),
        editing: true
      }
    }));
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Future Income Milestones &amp; Family Directives</h3>
        </div>
      </div>
      <div className="space-y-4">
        {ssnAssets.concat(pensionAssets, ppfAssets).map((asset: any) => {
          const cur = asset.nativeCurrency || 'USD';
          const editing = isEditing(asset.id);

          return (
            <div key={asset.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div className="min-w-0 space-y-1 flex-1">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{asset.name || 'Income Stream'}</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Owner: <span className="text-slate-700 dark:text-slate-300 font-medium">{asset.user?.fullName || 'Family Member'}</span>
                </div>
                {editing ? (
                  <textarea
                    value={getInstruction(asset)}
                    onChange={(e) => updateField(asset.id, 'instruction', e.target.value)}
                    className="w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none resize-none shadow-xs"
                    rows={2}
                  />
                ) : (
                  <div className="text-xs text-slate-500 dark:text-slate-400">{getInstruction(asset)}</div>
                )}
              </div>

              {/* Compact, clean target value badge & edit button */}
              <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl shadow-xs">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-medium">Target Value / Payout</span>
                  {editing ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <input
                        type="number"
                        value={getAmount(asset)}
                        onChange={(e) => updateField(asset.id, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-28 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-slate-900 dark:text-white font-bold focus:outline-none"
                      />
                      <span className="text-xs font-sans text-slate-500 dark:text-slate-400">{cur}</span>
                    </div>
                  ) : (
                    <span className="text-sm font-mono text-teal-700 dark:text-teal-400 font-bold block mt-0.5">
                      {formatCompact(getAmount(asset), cur)} <span className="text-xs font-sans font-normal text-slate-500">{cur}</span>
                    </span>
                  )}
                </div>

                <button 
                  onClick={() => setEditing(asset.id, !editing)} 
                  className={`p-2.5 rounded-xl border transition cursor-pointer shadow-xs flex items-center justify-center ${
                    editing 
                      ? 'bg-teal-700 text-white border-teal-700 hover:bg-teal-800' 
                      : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                  title={editing ? "Save Milestone" : "Edit Milestone"}
                >
                  {editing ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}