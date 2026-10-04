'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatCompact } from '@/lib/format';
import { LIFE_EXPECTANCY, project, type PlanInputs } from '@/lib/retirementProjection';

/** The one-sentence answer to "will I be okay?", shown above all the detail. */
export default function RetirementVerdict({
  plan,
  symbol,
  currency,
}: {
  plan: PlanInputs;
  symbol: string;
  currency: string;
}) {
  const end = plan.endAge ?? LIFE_EXPECTANCY;
  if (!(plan.retirementAge >= plan.currentAge) || plan.retirementAge >= end || !(plan.annualSpend > 0)) return null;

  const r = project(plan);
  const perMonth = (n: number) => `${symbol}${formatCompact(n / 12, currency)}`;
  const lasts = r.depletedAge === null;

  return (
    <div
      className={`rounded-2xl border p-5 flex items-start gap-3 ${
        lasts
          ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/20'
          : 'border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/20'
      }`}
    >
      {lasts ? (
        <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
      ) : (
        <AlertTriangle className="w-6 h-6 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      )}
      <div className="space-y-1">
        <p className="text-base sm:text-lg font-bold leading-snug text-slate-900 dark:text-white">
          {lasts
            ? `At this pace your money lasts to ${end}, spending ${perMonth(plan.annualSpend)}/mo.`
            : `You'd run short at ${r.depletedAge}.`}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {lasts
            ? `Retiring at ${Math.round(plan.retirementAge)}, you could spend up to about ${perMonth(r.sustainableAnnual)}/mo and still reach ${end}.`
            : `Retiring at ${Math.round(plan.retirementAge)}, about ${perMonth(r.sustainableAnnual)}/mo would last to ${end}, against the ${perMonth(plan.annualSpend)}/mo planned.`}{' '}
          Today&rsquo;s money; assumptions below.
        </p>
      </div>
    </div>
  );
}
