'use client';

import { useMemo } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

const SHOWN = 6;

export default function EstateReadinessCard({ assets = [] }: any) {
  const { missing, total } = useMemo(() => {
    const rows = assets.filter((a: any) => {
      const type = (a.assetType || '').toUpperCase();
      const cat = (a.accountCategory || '').toUpperCase();
      return !(type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY');
    });
    const gaps = rows.filter(
      (a: any) => !(a.beneficiary || '').trim() && !(a.accessNotes || '').trim(),
    );
    return { missing: gaps, total: rows.length };
  }, [assets]);

  if (total === 0) return null;

  const allSet = missing.length === 0;
  const shown = missing.slice(0, SHOWN);
  const rest = missing.length - shown.length;

  return (
    <div
      className={`rounded-2xl p-5 shadow-sm border ${
        allSet
          ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20'
          : 'border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shrink-0">
          {allSet ? (
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          )}
        </div>
        <div className="min-w-0 space-y-1.5">
          <h4 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-tight">
            Estate readiness
          </h4>
          {allSet ? (
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              All {total} holdings have a beneficiary or access note recorded.
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {missing.length} of {total} holdings have no beneficiary or access instructions.
                Add them from each asset&rsquo;s Edit dialog.
              </p>
              <ul className="text-sm text-slate-700 dark:text-slate-200 space-y-0.5 pt-0.5">
                {shown.map((a: any) => (
                  <li key={a.id} className="truncate">
                    {a.name || 'Unnamed holding'}
                  </li>
                ))}
                {rest > 0 && (
                  <li className="text-xs text-slate-400 dark:text-slate-500">+{rest} more</li>
                )}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
