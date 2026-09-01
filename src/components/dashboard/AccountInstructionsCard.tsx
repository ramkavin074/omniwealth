'use client';

import { useMemo, useState } from 'react';
import { KeyRound, Check } from 'lucide-react';
import { updateAccountInstructionsAction } from '@/actions/vault';

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

type Account = { key: string; label: string; holdings: number; sample: string };

export default function AccountInstructionsCard({
  assets = [],
  instructions = '',
  canManage = false,
  embedded = false,
}: {
  assets?: any[];
  instructions?: string | null;
  canManage?: boolean;
  embedded?: boolean;
}) {
  const saved: Record<string, string> = useMemo(() => {
    try {
      const m = JSON.parse(instructions || '{}');
      return m && typeof m === 'object' && !Array.isArray(m) ? m : {};
    } catch {
      return {};
    }
  }, [instructions]);

  const accounts = useMemo<Account[]>(() => {
    const map = new Map<string, Account>();
    for (const a of assets) {
      const type = (a.assetType || '').toUpperCase();
      const cat = (a.accountCategory || '').toUpperCase();
      if (type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY') continue;
      const num = (a.accountNumber || '').trim();
      const key = `${cat}|${num}`;
      const label =
        num && num.toUpperCase() !== 'DEFAULT' ? `${catLabel(cat)} · ${num}` : catLabel(cat);
      const existing = map.get(key);
      if (existing) {
        existing.holdings += 1;
      } else {
        map.set(key, { key, label, holdings: 1, sample: a.name || '' });
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [assets]);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // Baselines updated after a successful save, so the row stops looking dirty
  // without mutating the memoized `saved` map.
  const [committed, setCommitted] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [error, setError] = useState('');

  if (accounts.length === 0) return null;

  const baseFor = (key: string) => (key in committed ? committed[key] : saved[key] || '');
  const valueFor = (key: string) => (key in drafts ? drafts[key] : baseFor(key));
  const dirty = (key: string) => key in drafts && drafts[key].trim() !== baseFor(key).trim();

  async function handleSave(key: string) {
    setError('');
    setSavingKey(key);
    const value = valueFor(key).trim();
    const res = await updateAccountInstructionsAction(key, value);
    setSavingKey('');
    if (res?.success) {
      setCommitted((c) => ({ ...c, [key]: value }));
      setSavedKey(key);
      setTimeout(() => setSavedKey((k) => (k === key ? '' : k)), 2000);
    } else {
      setError(res?.error || 'Failed to save.');
    }
  }

  const rootCls = embedded
    ? 'space-y-4'
    : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 transition-colors';

  return (
    <div className={rootCls}>
      {!embedded && (
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <KeyRound className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Account access &amp; instructions</h3>
        </div>
      )}

      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        One note per account for your family: where the login lives, who to call to transfer or
        claim it, and any timing (&ldquo;leave invested&rdquo; / &ldquo;claim at 62&rdquo;).
      </p>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>}

      <div className="space-y-3">
        {accounts.map((acct) => {
          const val = valueFor(acct.key);
          return (
            <div
              key={acct.key}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{acct.label}</span>
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
                  {acct.holdings} holding{acct.holdings === 1 ? '' : 's'}
                </span>
              </div>

              {canManage ? (
                <>
                  <textarea
                    value={val}
                    onChange={(e) => setDrafts((d) => ({ ...d, [acct.key]: e.target.value }))}
                    rows={3}
                    placeholder="Login is in 1Password under '…'. To transfer/claim: call … . Timing: …"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-600 resize-y leading-relaxed"
                  />
                  <div className="flex items-center justify-end gap-2">
                    {savedKey === acct.key && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Saved
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSave(acct.key)}
                      disabled={savingKey === acct.key || !dirty(acct.key)}
                      className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-[11px] font-semibold rounded-lg transition cursor-pointer disabled:opacity-40"
                    >
                      {savingKey === acct.key ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </>
              ) : val ? (
                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{val}</p>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 italic">No instructions recorded.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
