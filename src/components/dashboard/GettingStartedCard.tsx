'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, CreditCard, FileText, Users, Wallet, X } from 'lucide-react';

const DISMISS_KEY = 'ow.getting-started.dismissed.v1';

// Dismissal lives in localStorage. useSyncExternalStore gives a server
// snapshot of "dismissed" (so SSR renders nothing, no flash) and the real
// value after hydration.
const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false; // private mode: just show it
  }
}
function writeDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
}

interface Props {
  assets: any[];
  documents: any[];
  members: any[];
  membersReady: boolean;
  canAdd: boolean;
  canManage: boolean;
  onAddAsset: () => void;
  onImportStatement: () => void;
  onAddLiability: () => void;
  onUploadDocument: () => void;
}

function isLiability(a: any): boolean {
  const type = a?.assetType;
  const cat = a?.accountCategory;
  return type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY';
}

/**
 * First-run checklist for the Wealth tab. Completion is derived from the data
 * itself (no extra server state), the card hides itself once everything is
 * done, and it can be dismissed for good on this device.
 */
export default function GettingStartedCard({
  assets,
  documents,
  members,
  membersReady,
  canAdd,
  canManage,
  onAddAsset,
  onImportStatement,
  onAddLiability,
  onUploadDocument,
}: Props) {
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);
  // Which step is expanded; null means "the first unfinished one".
  const [openKey, setOpenKey] = useState<string | null>(null);

  const steps = useMemo(() => {
    const hasAccount = assets.some((a) => !isLiability(a));
    const hasDebt = assets.some(isLiability);
    const list = [
      {
        key: 'account',
        optional: false,
        done: hasAccount,
        icon: Wallet,
        title: 'Add your first account',
        hint: 'A bank account, investment, property or any asset.',
        action: (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onAddAsset} className={PRIMARY}>
              Add manually
            </button>
            <button type="button" onClick={onImportStatement} className={SECONDARY}>
              Import from a statement
            </button>
          </div>
        ),
      },
      {
        key: 'debt',
        optional: true,
        done: hasDebt,
        icon: CreditCard,
        title: 'Add loans or debts',
        hint: 'Optional. Mortgages and loans keep your net worth accurate.',
        action: (
          <button type="button" onClick={onAddLiability} className={SECONDARY}>
            Add a liability
          </button>
        ),
      },
      ...(canManage
        ? [
            {
              key: 'family',
              optional: true,
              done: members.length > 1,
              icon: Users,
              title: 'Invite your family',
              hint: 'Optional. Give a partner or relative their own access.',
              action: (
                <Link href="/profile?invite=1" className={SECONDARY}>
                  Invite a family member
                </Link>
              ),
            },
          ]
        : []),
      {
        key: 'vault',
        optional: true,
        done: documents.length > 0,
        icon: FileText,
        title: 'Store an important document',
        hint: 'Wills, deeds and statements, encrypted in your vault.',
        action: (
          <button type="button" onClick={onUploadDocument} className={SECONDARY}>
            Upload a document
          </button>
        ),
      },
    ];
    // Don't claim "invite family" is pending while members are still loading.
    return list.filter((s) => s.key !== 'family' || membersReady);
  }, [assets, documents, members, membersReady, canManage, onAddAsset, onImportStatement, onAddLiability, onUploadDocument]);

  if (dismissed || !canAdd) return null;

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  const dismiss = writeDismissed;

  const pct = Math.round((doneCount / steps.length) * 100);
  // Point at the first unfinished step.
  const nextKey = steps.find((s) => !s.done)?.key;
  const expandedKey = openKey && steps.some((s) => s.key === openKey && !s.done) ? openKey : nextKey;

  return (
    <section
      aria-label="Getting started"
      className="bg-white dark:bg-slate-900 border border-teal-200/70 dark:border-teal-900/60 rounded-2xl p-5 sm:p-6 shadow-sm print:hidden"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Get started with OmniWealth
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {doneCount} of {steps.length} done. The optional steps can be skipped.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss getting started"
          title="Hide this"
          className="p-1.5 -mr-1.5 -mt-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-teal-600 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mt-4 space-y-3">
        {steps.map((s) => {
          const Icon = s.icon;
          const isNext = s.key === expandedKey;
          return (
            <li
              key={s.key}
              className={`flex items-start gap-3 rounded-xl p-3 border transition ${
                s.done
                  ? 'border-transparent opacity-60'
                  : isNext
                    ? 'border-teal-200 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-950/30'
                    : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  s.done ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {s.done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  disabled={s.done}
                  onClick={() => setOpenKey(s.key)}
                  aria-expanded={!s.done && isNext}
                  className={`text-left text-sm font-semibold ${s.done ? 'line-through text-slate-500 cursor-default' : 'text-slate-900 dark:text-white cursor-pointer'}`}
                >
                  {s.title}
                  {!s.done && s.optional && !isNext && (
                    <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-slate-400">Optional</span>
                  )}
                </button>
                {!s.done && isNext && (
                  <>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.hint}</p>
                    <div className="mt-2.5">{s.action}</div>
                  </>
                )}
              </div>
              {!s.done && isNext && <ChevronRight className="w-4 h-4 text-teal-600 mt-1 shrink-0" aria-hidden />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const PRIMARY =
  'inline-flex items-center px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold transition cursor-pointer';
const SECONDARY =
  'inline-flex items-center px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer';
