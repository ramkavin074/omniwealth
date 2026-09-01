'use client';

import { Shield } from 'lucide-react';
import { formatCompact } from '@/lib/format';

export default function FutureMilestonesAndDirectives({ assets, embedded = false }: any) {
  const rootCls = embedded
    ? 'space-y-4'
    : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4';

  const ssnAssets = assets.filter((a: any) => a.accountCategory === 'SOCIAL_SECURITY');
  const pensionAssets = assets.filter((a: any) => a.accountCategory === 'PENSION' || a.assetType === 'PENSION');
  const ppfAssets = assets.filter((a: any) => a.accountCategory === 'PPF');
  const rows = ssnAssets.concat(pensionAssets, ppfAssets);

  const instructionFor = (category: string) => {
    if (category === 'SOCIAL_SECURITY') return 'Sovereign monthly pension stream, tracked separately. Excluded from liquid net worth.';
    if (category === 'PENSION') return 'Guaranteed monthly pension tier, claimable on reaching maturity.';
    return 'Family claiming instruction: submit forms at the designated branch on maturity.';
  };

  if (rows.length === 0) {
    return (
      <div className={rootCls}>
        {!embedded && (
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <Shield className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Milestones &amp; directives</h3>
          </div>
        )}
        <div className="text-center py-8 text-sm text-slate-500 dark:text-slate-400">
          No pension, provident fund, or social security assets logged yet. Add them to see future income streams here.
        </div>
      </div>
    );
  }

  return (
    <div className={rootCls}>
      {!embedded && (
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <Shield className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Milestones &amp; directives</h3>
        </div>
      )}
      <div className="space-y-4">
        {rows.map((asset: any) => {
          const cur = asset.nativeCurrency || 'USD';
          const amount = parseFloat(asset.nativeValue || '0');
          return (
            <div
              key={asset.id}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
            >
              <div className="min-w-0 space-y-1 flex-1">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {asset.name || 'Income Stream'}
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Owner:{' '}
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {asset.user?.fullName || 'Family Member'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {instructionFor(asset.accountCategory)}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-xl shadow-xs shrink-0 self-start md:self-center">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-medium">
                  Target value / payout
                </span>
                <span className="text-sm font-mono text-teal-700 dark:text-teal-400 font-bold block mt-0.5">
                  {formatCompact(amount, cur)} <span className="text-xs font-sans font-normal text-slate-500">{cur}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
