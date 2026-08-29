'use client';

import { useState } from 'react';
import { Shield, Edit3 } from 'lucide-react';

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
      <div className="space-y-3">
        {ssnAssets.concat(pensionAssets, ppfAssets).map((asset: any) => {
          const cur = asset.nativeCurrency || 'USD';
          return (
            <div key={asset.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-4 shadow-sm">
              <div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{asset.name || 'Income Stream'}</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                  Owner: <span className="text-slate-700 dark:text-slate-300 font-medium">{asset.user?.fullName || 'Family Member'}</span>
                </div>
                {isEditing(asset.id) ? (
                  <textarea
                    value={getInstruction(asset)}
                    onChange={(e) => updateField(asset.id, 'instruction', e.target.value)}
                    className="w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none resize-none shadow-sm"
                    rows={2}
                  />
                ) : (
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{getInstruction(asset)}</div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl flex-1 shadow-sm">
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Target Value / Payout</span>
                  {isEditing(asset.id) ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="number"
                        value={getAmount(asset)}
                        onChange={(e) => updateField(asset.id, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-full max-w-[120px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-slate-900 dark:text-white font-bold focus:outline-none"
                      />
                      <span className="text-xs text-slate-500 dark:text-slate-400">{cur}</span>
                    </div>
                  ) : (
                    <span className="text-sm font-mono text-slate-900 dark:text-white font-bold">{getAmount(asset).toLocaleString()} {cur}</span>
                  )}
                </div>
                <button 
                  onClick={() => setEditing(asset.id, !isEditing(asset.id))} 
                  className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-xl cursor-pointer shadow-sm transition shrink-0 flex items-center justify-center"
                  title="Edit Milestone"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}