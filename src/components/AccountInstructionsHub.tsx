'use client';

import { useState, useMemo } from 'react';
import { Shield } from 'lucide-react';

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

export default function AccountInstructionsHub({ assets }: any) {
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [instructionsMap, setInstructionsMap] = useState<{ [key: string]: string }>({});
  const [editingNote, setEditingNote] = useState('');
  
  const uniqueAccounts = useMemo(() => Array.from(new Set(assets.map((a: any) => `${formatCategoryName(a.accountCategory)} (${a.accountNumber || 'Primary'})`))), [assets]);

  if (uniqueAccounts.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 transition-colors">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <Shield className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">
          Institution &amp; Account-Level Family Directives
        </h3>
      </div>
       
      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        Write overarching login protocols, broker contact details, and succession steps for entire accounts.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="space-y-2">
          <label className="block text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 tracking-wider">
            Select Account / Institution
          </label>
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 mt-2">
            {uniqueAccounts.map((acct: any) => (
              <button
                key={acct}
                onClick={() => { setSelectedAccount(acct); setEditingNote(instructionsMap[acct] || ''); }}
                className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-mono transition-colors cursor-pointer border break-words ${selectedAccount === acct ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white font-bold shadow-sm' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                {acct}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-sm">
          {selectedAccount ? (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-900 dark:text-white break-words">
                Directives for: <span className="text-teal-700 dark:text-teal-400 font-mono">{selectedAccount}</span>
              </div>
              <textarea
                value={editingNote}
                onChange={(e) => setEditingNote(e.target.value)}
                placeholder="Enter succession notes, broker estate desk info, or multi-stock transfer instructions..."
                rows={5}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-600 resize-none shadow-sm leading-relaxed"
              />
              <div className="flex justify-end">
                <button
                  onClick={() => { setInstructionsMap(prev => ({ ...prev, [selectedAccount]: editingNote })); alert('Account instructions saved!'); }}
                  className="w-full sm:w-auto px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-xl cursor-pointer shadow-sm transition-colors"
                >
                  Save Account Notes
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-slate-400 dark:text-slate-500 py-12 text-center px-4">
              Select an account from the left list to view or edit master family instructions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}