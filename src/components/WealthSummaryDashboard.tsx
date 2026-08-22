'use client';

import { useState } from 'react';
import { Users, Target, ChevronDown, ChevronUp, FileText } from 'lucide-react';

interface Asset {
  id: string;
  name: string;
  ticker?: string;
  assetType: string;
  accountCategory: string;
  accountNumber: string;
  rationale: string;
  nativeValue: number;
  nativeCurrency: string;
  user?: {
    fullName: string;
  };
}

export default function WealthSummaryDashboard({ assets, baseCurrency }: { assets: Asset[]; baseCurrency: string }) {
  // State to track which cards are expanded for drill-down view
  const [expandedMembers, setExpandedMembers] = useState<{ [key: string]: boolean }>({});
  const [expandedPurposes, setExpandedPurposes] = useState<{ [key: string]: boolean }>({});

  const toggleMember = (name: string) => {
    setExpandedMembers((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const togglePurpose = (purpose: string) => {
    setExpandedPurposes((prev) => ({ ...prev, [purpose]: !prev[purpose] }));
  };

  const totalNetWorth = assets.reduce((sum, asset) => sum + asset.nativeValue, 0);

  // Group by Family Member
  const memberSubTotals: { [memberName: string]: { total: number; assets: Asset[] } } = {};
  assets.forEach((asset) => {
    const memberName = asset.user?.fullName || 'Family General';
    if (!memberSubTotals[memberName]) {
      memberSubTotals[memberName] = { total: 0, assets: [] };
    }
    memberSubTotals[memberName].total += asset.nativeValue;
    memberSubTotals[memberName].assets.push(asset);
  });

  // Group by Purpose / Rationale
  const purposeSubTotals: { [rationale: string]: { total: number; assets: Asset[] } } = {};
  assets.forEach((asset) => {
    const purpose = asset.rationale || 'General Long-Term Growth';
    if (!purposeSubTotals[purpose]) {
      purposeSubTotals[purpose] = { total: 0, assets: [] };
    }
    purposeSubTotals[purpose].total += asset.nativeValue;
    purposeSubTotals[purpose].assets.push(asset);
  });

  return (
    <div className="space-y-6">
      {/* Global Net Worth Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-indigo-400 font-semibold">Global Household Net Worth</span>
          <div className="text-3xl font-extrabold font-mono text-white mt-1">
            {totalNetWorth.toLocaleString()} <span className="text-indigo-400 text-lg">{baseCurrency}</span>
          </div>
        </div>
        <div className="text-xs text-slate-400 bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
          Click any card below to drill down into individual asset lines and custom account instructions.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Family Members Sub-Totals with Drill-Down */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
            <Users className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Family Member Sub-Totals</h3>
          </div>

          <div className="space-y-3">
            {Object.entries(memberSubTotals).map(([name, data]) => {
              const percentage = totalNetWorth > 0 ? ((data.total / totalNetWorth) * 100).toFixed(1) : '0';
              const isExpanded = expandedMembers[name];

              return (
                <div key={name} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleMember(name)}
                    className="w-full p-4 flex justify-between items-center text-left hover:bg-slate-900/50 transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-white text-sm">{name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{data.assets.length} asset container(s)</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-emerald-400 font-semibold text-sm">
                        {data.total.toLocaleString()} {baseCurrency} <span className="text-slate-500 text-xs">({percentage}%)</span>
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>

                  {/* Expanded Individual Asset Lines */}
                  {isExpanded && (
                    <div className="border-t border-slate-900 p-4 space-y-2 bg-slate-950/80">
                      <div className="text-[10px] uppercase font-bold text-slate-500 mb-2">Underlying Holdings:</div>
                      {data.assets.map((asset) => (
                        <div key={asset.id} className="flex justify-between items-center text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                          <div>
                            <span className="font-bold text-white">{asset.name}</span>
                            {asset.ticker && <span className="font-mono text-indigo-400 ml-1.5">({asset.ticker})</span>}
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Acct #: <span className="font-mono text-slate-300">{asset.accountNumber}</span> | Type: <span className="text-indigo-300">{asset.accountCategory}</span>
                            </div>
                          </div>
                          <span className="font-mono text-emerald-400 font-semibold">
                            {asset.nativeValue.toLocaleString()} {baseCurrency}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Purpose Sub-Totals & Legacy Instructions with Drill-Down */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
            <Target className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Purpose &amp; Legacy Instructions</h3>
          </div>

          <div className="space-y-3">
            {Object.entries(purposeSubTotals).map(([purpose, data]) => {
              const percentage = totalNetWorth > 0 ? ((data.total / totalNetWorth) * 100).toFixed(1) : '0';
              const isExpanded = expandedPurposes[purpose];

              return (
                <div key={purpose} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => togglePurpose(purpose)}
                    className="w-full p-4 flex justify-between items-center text-left hover:bg-slate-900/50 transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        {purpose}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{data.assets.length} linked account(s)</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-emerald-400 font-semibold text-sm">
                        {data.total.toLocaleString()} {baseCurrency} <span className="text-slate-500 text-xs">({percentage}%)</span>
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>

                  {/* Expanded Purpose Details & Legacy Directives */}
                  {isExpanded && (
                    <div className="border-t border-slate-900 p-4 space-y-3 bg-slate-950/80">
                      {/* Owner-defined Legacy Directive Note */}
                      <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3 text-xs text-slate-200">
                        <div className="flex items-center gap-1.5 text-indigo-400 font-bold mb-1">
                          <FileText className="w-3.5 h-3.5" />
                          <span className="uppercase text-[10px]">Account-Specific Legacy Directive:</span>
                        </div>
                        <p className="italic text-slate-300">
                          &quot;{purpose}&quot; — If funds are not fully utilized for this primary objective, reallocate to designated successor and convert to IRA or trust buffer.
                        </p>
                      </div>

                      <div className="text-[10px] uppercase font-bold text-slate-500 mt-2">Assets Tied to This Purpose:</div>
                      {data.assets.map((asset) => (
                        <div key={asset.id} className="flex justify-between items-center text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                          <div>
                            <span className="font-bold text-white">{asset.name}</span>
                            {asset.ticker && <span className="font-mono text-indigo-400 ml-1.5">({asset.ticker})</span>}
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Category: <span className="text-indigo-300">{asset.accountCategory}</span> | Acct #: <span className="font-mono text-slate-300">{asset.accountNumber}</span>
                            </div>
                          </div>
                          <span className="font-mono text-emerald-400 font-semibold">
                            {asset.nativeValue.toLocaleString()} {baseCurrency}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}