'use client';

import { useMemo } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

const SHOWN = 6;

function catLabel(cat: string): string {
  const c = (cat || 'INDIVIDUAL').toUpperCase();
  const map: Record<string, string> = {
    REAL_ESTATE: 'Real estate',
    SOCIAL_SECURITY: 'Social Security',
    ROTH_IRA: 'Roth IRA',
    IRA: 'Traditional IRA',
    '401K': '401(k)',
    PPF: 'PPF',
    PF: 'PF / EPF',
    HSA: 'HSA',
    PENSION: 'Pension',
    '529': '529 College',
    TRUST: 'Trust',
    INDIVIDUAL: 'Individual',
  };
  return map[c] || c.replace(/_/g, ' ');
}

export default function EstateReadinessCard({ assets = [] }: any) {
  const { missing, total } = useMemo(() => {
    // Beneficiary / access notes belong to an account, not a single
    // holding — so group by (category, account number) and check whether
    // anything in that account carries the info.
    const accounts = new Map<string, { label: string; covered: boolean }>();
    for (const a of assets) {
      const type = (a.assetType || '').toUpperCase();
      const cat = (a.accountCategory || '').toUpperCase();
      if (type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY') continue;

      const num = (a.accountNumber || '').trim();
      const key = `${cat}|${num}`;
      const label =
        num && num.toUpperCase() !== 'DEFAULT'
          ? `${catLabel(cat)} ·  ${num}`
          : catLabel(cat);

      const hasInfo = !!(a.beneficiary || '').trim() || !!(a.accessNotes || '').trim();
      const existing = accounts.get(key);
      if (existing) {
        existing.covered = existing.covered || hasInfo;
      } else {
        accounts.set(key, { label, covered: hasInfo });
      }
    }

    const all = [...accounts.values()];
    return { missing: all.filter((x) => !x.covered), total: all.length };
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
              All {total} account{total === 1 ? '' : 's'} have a beneficiary or access note recorded.
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {missing.length} of {total} account{total === 1 ? '' : 's'} have no beneficiary or
                access instructions. Add them from any holding in the account&rsquo;s Edit dialog.
              </p>
              <ul className="text-sm text-slate-700 dark:text-slate-200 space-y-0.5 pt-0.5">
                {shown.map((acct) => (
                  <li key={acct.label} className="truncate">
                    {acct.label}
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
