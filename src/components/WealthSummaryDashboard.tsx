'use client';

import { useMemo } from 'react';
import { Users, Target } from 'lucide-react';

export default function WealthSummaryDashboard({ assets, baseCurrency, legacyPillars, liveRates }: any) {
  const { sortedMembers, sortedPurposes } = useMemo(() => {
    const memberMap: { [key: string]: { total: number; assets: any[] } } = {};
    assets.forEach((a: any) => {
      const type = (a.assetType || '').toUpperCase();
      const cat = (a.accountCategory || '').toUpperCase();
      if (type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY' || cat === 'DEBT') return;
      const name = a.user?.fullName || 'Family General';
      if (!memberMap[name]) memberMap[name] = { total: 0, assets: [] };
      const baseVal = parseFloat(a.nativeValue || '0');
      memberMap[name].total += Math.abs(baseVal);
      memberMap[name].assets.push(a);
    });

    const sMembers = Object.entries(memberMap).sort((a, b) => b[1].total - a[1].total);

    const purposeMap: { [key: string]: { total: number; assets: any[] } } = {};
    assets.forEach((a: any) => {
      const type = (a.assetType || '').toUpperCase();
      const cat = (a.accountCategory || '').toUpperCase();
      if (type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY' || cat === 'DEBT') return;
      const p = a.rationale || legacyPillars[0]?.name || 'General Long-Term Growth';
      if (!purposeMap[p]) purposeMap[p] = { total: 0, assets: [] };
      const baseVal = parseFloat(a.nativeValue || '0');
      purposeMap[p].total += Math.abs(baseVal);
      purposeMap[p].assets.push(a);
    });

    const sPurposes = Object.entries(purposeMap).sort((a, b) => b[1].total - a[1].total);

    return { sortedMembers: sMembers, sortedPurposes: sPurposes };
  }, [assets, baseCurrency, legacyPillars, liveRates]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm print:border-slate-300 print:shadow-none">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <Users className="w-5 h-5 text-slate-500 dark:text-slate-400 print:hidden" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Wealth by Family Member</h3>
        </div>
        <div className="space-y-3">
          {sortedMembers.map(([name, data]: [string, any]) => (
            <div key={name} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden min-w-0 shadow-sm print:border-slate-300 print:bg-white">
              <div className="w-full p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center text-left min-w-0 gap-3">
                <div className="min-w-0 pr-2">
                  <div className="font-bold text-slate-900 dark:text-white text-sm leading-snug break-words">{name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{data.assets.length} consolidated holding(s)</div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <span className="font-mono text-slate-900 dark:text-white font-semibold text-sm">{Math.round(data.total).toLocaleString()} {baseCurrency}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm print:border-slate-300 print:shadow-none">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <Target className="w-5 h-5 text-slate-500 dark:text-slate-400 print:hidden" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Purpose &amp; Legacy Instructions</h3>
        </div>
        <div className="space-y-3">
          {sortedPurposes.map(([purposeName, data]: [string, any]) => (
            <div key={purposeName} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden min-w-0 shadow-sm print:border-slate-300 print:bg-white">
              <div className="w-full p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center text-left min-w-0 gap-3">
                <div className="min-w-0 pr-2">
                  <div className="font-bold text-slate-900 dark:text-white text-sm leading-snug break-words">{purposeName}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{data.assets.length} consolidated holding(s)</div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <span className="font-mono text-slate-900 dark:text-white font-semibold text-sm">{Math.round(data.total).toLocaleString()} {baseCurrency}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}