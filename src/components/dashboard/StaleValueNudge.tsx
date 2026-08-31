'use client';

import { useMemo, useState } from 'react';
import { Clock, X } from 'lucide-react';

const STORAGE_KEY = 'omniwealth_stale_dismissed';
const STALE_DAYS = 90;
const SHOWN = 5;

function ageLabel(ms: number): string {
  const days = Math.floor(ms / 86400000);
  if (days < 60) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 18) return `${months} months ago`;
  return `${Math.floor(days / 365)}+ years ago`;
}

export default function StaleValueNudge({ assets = [] }: any) {
  // Read the clock once, in a lazy initializer, so the memo stays pure.
  const [now] = useState(() => Date.now());

  const stale = useMemo(() => {
    const cutoff = STALE_DAYS * 86400000;
    return assets
      .map((a: any) => {
        const t = new Date(a.updatedAt || a.createdAt || 0).getTime();
        return { id: a.id, name: a.name || 'Unnamed holding', age: now - t, valid: Number.isFinite(t) && t > 0 };
      })
      .filter((x: any) => x.valid && x.age > cutoff)
      .sort((a: any, b: any) => b.age - a.age);
  }, [assets, now]);

  const signature = useMemo(() => stale.map((s: any) => s.id).sort().join('|'), [stale]);

  const [dismissedSig, setDismissedSig] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  if (stale.length === 0 || signature === dismissedSig) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, signature);
    } catch {
      /* ignore */
    }
    setDismissedSig(signature);
  };

  const shown = stale.slice(0, SHOWN);
  const rest = stale.length - shown.length;

  return (
    <div className="border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl p-5 shadow-sm flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="p-2 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-xl shrink-0">
          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0 space-y-1.5">
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">Values may be out of date</h4>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {stale.length === 1 ? '1 holding has' : `${stale.length} holdings have`} not been updated in over{' '}
            {STALE_DAYS} days. Refresh them so snapshots and the trend stay accurate.
          </p>
          <ul className="text-sm text-slate-700 dark:text-slate-200 space-y-0.5 pt-0.5">
            {shown.map((s: any) => (
              <li key={s.id} className="flex items-baseline gap-2 min-w-0">
                <span className="truncate">{s.name}</span>
                <span className="text-slate-400 dark:text-slate-500 text-xs shrink-0">{ageLabel(s.age)}</span>
              </li>
            ))}
            {rest > 0 && <li className="text-xs text-slate-400 dark:text-slate-500">+{rest} more</li>}
          </ul>
        </div>
      </div>
      <button
        onClick={dismiss}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-amber-100/60 dark:hover:bg-amber-900/30 cursor-pointer shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
