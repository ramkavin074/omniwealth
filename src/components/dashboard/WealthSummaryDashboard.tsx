'use client';

import { useState, useMemo } from 'react';
import { Users, Target, ChevronDown, ChevronUp, Edit3 } from 'lucide-react';
import { formatCompact, formatQty } from '@/lib/format';

const FX_RATES: { [key: string]: number } = {
  USD: 1, EUR: 1.08, GBP: 1.28, CAD: 0.74, AUD: 0.65, INR: 0.012, JPY: 0.0067, CHF: 1.12, CNY: 0.149,
};

function convertCurrency(amount: number, fromCurr: string, toCurr: string, rates: { [key: string]: number } = FX_RATES): number {
  if (fromCurr === toCurr) return amount;
  const rateFrom = rates[fromCurr] || 1;
  const rateTo = rates[toCurr] || 1;
  return (amount * rateTo) / rateFrom;
}

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

function groupAssets(rawAssets: any[], baseCurrency: string, liveRates: { [key: string]: number }) {
  const map: { [key: string]: any } = {};
  rawAssets.forEach(a => {
    const key = a.ticker ? a.ticker.toUpperCase().trim() : a.name.toLowerCase().trim();
    const nativeVal = parseFloat(a.nativeValue || '0');
    const baseVal = convertCurrency(nativeVal, a.nativeCurrency || 'USD', baseCurrency, liveRates);

    if (!map[key]) {
      map[key] = {
        ...a,
        totalNative: nativeVal,
        totalBase: baseVal,
        totalQty: parseFloat(a.quantity || '1'),
        accounts: [formatCategoryName(a.accountCategory)],
        ids: [a.id],
        rawAssets: [a]
      };
    } else {
      map[key].totalNative += nativeVal;
      map[key].totalBase += baseVal;
      map[key].totalQty += parseFloat(a.quantity || '1');
      const formattedCat = formatCategoryName(a.accountCategory);
      if (!map[key].accounts.includes(formattedCat)) {
        map[key].accounts.push(formattedCat);
      }
      map[key].ids.push(a.id);
      map[key].rawAssets.push(a);
    }
  });

  return Object.values(map).sort((a: any, b: any) => b.totalBase - a.totalBase);
}

export default function WealthSummaryDashboard({ assets, baseCurrency, legacyPillars, liveRates = FX_RATES, onEditAsset, forceExpanded = false, only }: any) {
  const [expandedMembers, setExpandedMembers] = useState<{ [key: string]: boolean }>({});
  const [expandedPurposes, setExpandedPurposes] = useState<{ [key: string]: boolean }>({});

  const toggleMember = (name: string) => {
    setExpandedMembers(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const togglePurpose = (purpose: string) => {
    setExpandedPurposes(prev => ({ ...prev, [purpose]: !prev[purpose] }));
  };

  const { sortedMembers, sortedPurposes } = useMemo(() => {
    const memberMap: { [key: string]: { total: number; assets: any[] } } = {};
    assets.forEach((a: any) => {
      const type = (a.assetType || '').toUpperCase();
      const cat = (a.accountCategory || '').toUpperCase();
      if (type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY' || cat === 'DEBT') return;
      const name = a.user?.fullName || 'Family General';
      if (!memberMap[name]) memberMap[name] = { total: 0, assets: [] };
      
      const val = parseFloat(a.nativeValue || '0');
      const curr = a.nativeCurrency || 'USD';
      const baseVal = convertCurrency(val, curr, baseCurrency, liveRates);

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

      const val = parseFloat(a.nativeValue || '0');
      const curr = a.nativeCurrency || 'USD';
      const baseVal = convertCurrency(val, curr, baseCurrency, liveRates);

      purposeMap[p].total += Math.abs(baseVal);
      purposeMap[p].assets.push(a);
    });

    const sPurposes = Object.entries(purposeMap).sort((a, b) => b[1].total - a[1].total);

    return { sortedMembers: sMembers, sortedPurposes: sPurposes };
  }, [assets, baseCurrency, legacyPillars, liveRates]);

  return (
    <div className={only ? '' : 'grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1'}>
      {only !== 'purposes' && (
      <div className={only ? "" : "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm print:border-slate-300 print:shadow-none"}>
        {!only && (
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
            <Users className="w-5 h-5 text-slate-500 dark:text-slate-400 print:hidden" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Wealth by Family Member</h3>
          </div>
        )}
        <div className="space-y-3">
          {sortedMembers.map(([name, data]: [string, any]) => {
            const isExpanded = forceExpanded || expandedMembers[name];
            const grouped = groupAssets(data.assets, baseCurrency, liveRates);

            return (
              <div key={name} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden min-w-0 shadow-sm print:border-slate-300 print:bg-white">
                <button 
                  onClick={() => toggleMember(name)}
                  className="w-full p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center text-left min-w-0 gap-3 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-900/50 transition-colors"
                >
                  <div className="min-w-0 pr-2 flex items-center gap-2.5">
                    <div className="p-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white text-sm leading-snug break-words">{name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{grouped.length} consolidated holding(s)</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span className="font-mono text-slate-900 dark:text-white font-semibold text-sm">{formatCompact(data.total, baseCurrency)} {baseCurrency}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900/50">
                    {grouped.map((item: any) => (
                      <div key={item.id} className="p-3.5 pl-6 sm:pl-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="truncate">{item.name}</span>
                            {item.ticker && <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">{item.ticker}</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Accounts: {item.accounts.join(', ')} • Qty: {formatQty(item.totalQty)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {formatCompact(item.totalBase, baseCurrency)} {baseCurrency}
                          </span>
                          <div className="flex items-center gap-1">
                            {onEditAsset && (
                              <button 
                                onClick={() => onEditAsset(item)} 
                                className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg transition cursor-pointer" 
                                title="Edit Asset"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      )}

      {only !== 'members' && (
      <div className={only ? "" : "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm print:border-slate-300 print:shadow-none"}>
        {!only && (
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
            <Target className="w-5 h-5 text-slate-500 dark:text-slate-400 print:hidden" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Purpose &amp; Legacy Instructions</h3>
          </div>
        )}
        <div className="space-y-3">
          {sortedPurposes.map(([purposeName, data]: [string, any]) => {
            const isExpanded = forceExpanded || expandedPurposes[purposeName];
            const grouped = groupAssets(data.assets, baseCurrency, liveRates);

            return (
              <div key={purposeName} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden min-w-0 shadow-sm print:border-slate-300 print:bg-white">
                <button 
                  onClick={() => togglePurpose(purposeName)}
                  className="w-full p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center text-left min-w-0 gap-3 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-900/50 transition-colors"
                >
                  <div className="min-w-0 pr-2 flex items-center gap-2.5">
                    <div className="p-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white text-sm leading-snug break-words">{purposeName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{grouped.length} consolidated holding(s)</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span className="font-mono text-slate-900 dark:text-white font-semibold text-sm">{formatCompact(data.total, baseCurrency)} {baseCurrency}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900/50">
                    {grouped.map((item: any) => (
                      <div key={item.id} className="p-3.5 pl-6 sm:pl-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="truncate">{item.name}</span>
                            {item.ticker && <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">{item.ticker}</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Owner: {item.user?.fullName || 'Family Member'} • Qty: {formatQty(item.totalQty)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {formatCompact(item.totalBase, baseCurrency)} {baseCurrency}
                          </span>
                          <div className="flex items-center gap-1">
                            {onEditAsset && (
                              <button 
                                onClick={() => onEditAsset(item)} 
                                className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg transition cursor-pointer" 
                                title="Edit Asset"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}