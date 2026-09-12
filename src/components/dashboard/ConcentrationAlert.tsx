'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { formatCompact } from '@/lib/format';
import { detectConcentrationFlags, type ConcentrationFlag } from '@/lib/networth';

const STORAGE_KEY = 'omniwealth_concentration_dismissed';

export default function ConcentrationAlert({ assets = [], baseCurrency = 'USD', liveRates = {} }: any) {
  const flags = useMemo<ConcentrationFlag[]>(
    () => detectConcentrationFlags(assets, baseCurrency, liveRates),
    [assets, baseCurrency, liveRates],
  );

  // Signature changes when the flagged set or any share moves by ~5 points,
  // so a dismissed alert reappears if the picture materially shifts.
  const signature = useMemo(
    () => flags.map((f) => `${f.key}@${Math.round(f.pct / 5) * 5}`).join('|'),
    [flags],
  );

  const [dismissedSig, setDismissedSig] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  if (flags.length === 0 || signature === dismissedSig) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, signature);
    } catch {
      /* ignore */
    }
    setDismissedSig(signature);
  };

  return (
    <div className="border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl p-5 shadow-sm flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="p-2 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-xl shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0 space-y-1.5">
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">Concentration check</h4>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {flags.length === 1 ? 'One position is' : `${flags.length} positions are`} a large share
            of household assets:
          </p>
          <ul className="text-sm text-slate-700 dark:text-slate-200 space-y-0.5">
            {flags.map((f) => (
              <li key={f.key} className="flex items-baseline gap-2">
                <span className="font-mono font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                  {f.pct.toFixed(0)}%
                </span>
                <span className="truncate">{f.label}</span>
                <span className="text-slate-400 dark:text-slate-500 text-xs shrink-0">
                  {formatCompact(f.value, baseCurrency)} {baseCurrency}
                </span>
              </li>
            ))}
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
