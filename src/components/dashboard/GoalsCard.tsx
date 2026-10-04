'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { formatCompact } from '@/lib/format';
import type { Goal } from '@/lib/goals';

function dateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function statusLine(g: Goal, baseCurrency: string): string {
  if (g.status === 'reached') return 'Goal reached';
  if (g.daysLeft === null) return `${formatCompact(g.target - g.current, baseCurrency)} ${baseCurrency} to go`;
  if (g.status === 'overdue') {
    return `Target date passed ${Math.abs(g.daysLeft)} day${Math.abs(g.daysLeft) === 1 ? '' : 's'} ago`;
  }
  const when = `by ${dateLabel(g.targetDate as string)}`;
  return g.monthlyNeeded
    ? `About ${formatCompact(g.monthlyNeeded, baseCurrency)} ${baseCurrency}/month to reach it ${when}`
    : `Target ${when}`;
}

export default function GoalsCard({
  goals,
  baseCurrency,
  canManage,
}: {
  goals: Goal[];
  baseCurrency: string;
  canManage: boolean;
}) {
  return (
    <div className="space-y-4">
      <ul className="space-y-4">
        {goals.map((g) => (
          <li key={g.name} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-white">
                {g.status === 'reached' && <Check className="inline w-3.5 h-3.5 mr-1 text-emerald-600" aria-hidden />}
                {g.name}
              </span>
              <span className="shrink-0 font-mono text-xs text-slate-500 dark:text-slate-400">
                {Math.floor(g.pct)}%
              </span>
            </div>
            <div
              className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
              role="progressbar"
              aria-valuenow={Math.floor(g.pct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${g.name} progress`}
            >
              <div
                className={`h-full rounded-full transition-all ${
                  g.status === 'reached' ? 'bg-emerald-600' : g.status === 'overdue' ? 'bg-amber-500' : 'bg-teal-600'
                }`}
                style={{ width: `${g.pct}%` }}
              />
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="font-mono">
                {formatCompact(g.current, baseCurrency)} / {formatCompact(g.target, baseCurrency)} {baseCurrency}
              </span>
              <span>{statusLine(g, baseCurrency)}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Counts holdings tagged with each goal as their purpose. The monthly figure is a straight-line estimate and
        ignores growth.{' '}
        {canManage && (
          <Link href="/profile" className="underline underline-offset-2">
            Edit goals
          </Link>
        )}
      </p>
    </div>
  );
}
