'use client';

import { useSyncExternalStore } from 'react';
import { FileSpreadsheet, FileText, Plus, X } from 'lucide-react';

const KEY = 'ow.first-account-prompt.v1';

// Same pattern as GettingStartedCard: server snapshot = "dismissed" so nothing
// flashes during SSR; the real value is read after hydration.
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
function readDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
function dismiss() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
}

const isLiability = (a: any) => {
  const t = (a?.assetType || '').toUpperCase();
  const c = (a?.accountCategory || '').toUpperCase();
  return t === 'LIABILITY' || t === 'DEBT' || c === 'LIABILITY';
};

/**
 * One-time welcome-back nudge for a household that has signed up but never
 * added anything. Shown once per device; "Not now" or using any button hides it.
 */
export default function FirstAccountPrompt({
  assets,
  canAdd,
  onAddAsset,
  onImportStatement,
  onImportCsv,
}: {
  assets: any[];
  canAdd: boolean;
  onAddAsset: () => void;
  onImportStatement: () => void;
  onImportCsv: () => void;
}) {
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);
  if (dismissed || !canAdd || assets.some((a) => !isLiability(a))) return null;

  const go = (fn: () => void) => () => {
    dismiss();
    fn();
  };
  const btn =
    'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors';

  return (
    <div className="relative rounded-2xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/70 dark:bg-teal-950/30 p-5 print:hidden">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        className="absolute right-3 top-3 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
      <h3 className="pr-8 text-base font-bold text-slate-900 dark:text-white">Your vault is empty. Add your first account.</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Add one bank account, investment or property to see your net worth. It takes about two minutes, and you can change
        or remove anything later.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={go(onAddAsset)} className={`${btn} bg-teal-700 hover:bg-teal-600 text-white`}>
          <Plus className="w-4 h-4" /> Add manually
        </button>
        <button
          type="button"
          onClick={go(onImportStatement)}
          className={`${btn} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-600`}
        >
          <FileText className="w-4 h-4" /> Import a statement
        </button>
        <button
          type="button"
          onClick={go(onImportCsv)}
          className={`${btn} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-600`}
        >
          <FileSpreadsheet className="w-4 h-4" /> Import a spreadsheet
        </button>
        <button type="button" onClick={dismiss} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer">
          Not now
        </button>
      </div>
    </div>
  );
}
