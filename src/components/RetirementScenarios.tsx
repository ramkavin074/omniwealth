'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatCompact } from '@/lib/format';
import { LIFE_EXPECTANCY, SCENARIOS, project, type PlanInputs } from '@/lib/retirementProjection';

const COLORS = ['#0f766e', '#d97706', '#e11d48', '#7c3aed', '#0284c7', '#64748b'];
const DEFAULT_ON = ['base', 'lowReturns', 'crash'];

export default function RetirementScenarios({
  plan,
  symbol,
  currency,
}: {
  plan: PlanInputs;
  symbol: string;
  currency: string;
}) {
  const [on, setOn] = useState<string[]>(DEFAULT_ON);

  const runs = useMemo(
    () =>
      SCENARIOS.map((s, i) => {
        const { inputs, shock } = s.apply(plan);
        return { s, color: COLORS[i % COLORS.length], inputs, result: project(inputs, shock) };
      }),
    [plan],
  );

  const valid =
    plan.currentAge >= 0 && plan.retirementAge > plan.currentAge - 1 && plan.retirementAge < LIFE_EXPECTANCY && plan.annualSpend > 0;
  if (!valid) return null;

  const base = runs[0];
  const shown = runs.filter((r) => on.includes(r.s.key));
  const money = (n: number) => `${symbol}${formatCompact(n, currency)}`;
  const monthly = (n: number) => `${money(n / 12)}/mo`;

  const toggle = (key: string) =>
    setOn((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));

  const lasts = base.result.depletedAge === null;
  const verdict = lasts
    ? `On this plan your money lasts past ${LIFE_EXPECTANCY}. From ${Math.round(plan.retirementAge)} you could spend about ${monthly(base.result.sustainableAnnual)} (today's money) and still reach ${LIFE_EXPECTANCY}.`
    : `On this plan your money runs out around age ${base.result.depletedAge}. To last to ${LIFE_EXPECTANCY}, spend about ${monthly(base.result.sustainableAnnual)} from ${Math.round(plan.retirementAge)} instead of ${monthly(plan.annualSpend)}, or save more / retire later.`;

  // Chart geometry
  const W = 600;
  const H = 220;
  const pad = { l: 8, r: 8, t: 10, b: 22 };
  const startAge = Math.round(plan.currentAge);
  const span = LIFE_EXPECTANCY - startAge || 1;
  const maxY = Math.max(1, ...shown.flatMap((r) => r.result.points.map((p) => p.balance)));
  const x = (age: number) => pad.l + ((age - startAge) / span) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / maxY) * (H - pad.t - pad.b);
  const path = (pts: { age: number; balance: number }[]) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.age).toFixed(1)},${y(p.balance).toFixed(1)}`).join(' ');

  return (
    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide">Will my money last?</h4>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          Your savings grow until you retire, then fund your spending to age {LIFE_EXPECTANCY}. All figures are in
          today&rsquo;s money.
        </p>
      </div>

      <div
        className={`flex items-start gap-3 rounded-xl border p-3.5 text-sm leading-relaxed ${
          lasts
            ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200'
            : 'border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200'
        }`}
      >
        {lasts ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
        <p>{verdict}</p>
      </div>

      <div>
        <p className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-2">
          What if&hellip; (tap to compare)
        </p>
        <div className="flex flex-wrap gap-2">
          {runs.slice(1).map((r) => {
            const active = on.includes(r.s.key);
            return (
              <button
                key={r.s.key}
                type="button"
                aria-pressed={active}
                title={r.s.hint}
                onClick={() => toggle(r.s.key)}
                className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                  active
                    ? 'bg-teal-700 border-teal-700 text-white'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-600'
                }`}
              >
                {r.s.label}
              </button>
            );
          })}
        </div>
      </div>

      <ul className="space-y-2">
        {shown.map((r) => {
          const ok = r.result.depletedAge === null;
          return (
            <li key={r.s.key} className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                {r.s.label}
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <dt className="text-[10px] uppercase text-slate-500 dark:text-slate-400">Money lasts</dt>
                  <dd className={`font-semibold ${ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                    {ok ? `Past ${LIFE_EXPECTANCY}` : `To age ${r.result.depletedAge}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-slate-500 dark:text-slate-400">Left at {LIFE_EXPECTANCY}</dt>
                  <dd className="font-mono text-slate-700 dark:text-slate-300">{money(r.result.balanceAtEnd)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-slate-500 dark:text-slate-400">Safe spend</dt>
                  <dd className="font-mono text-slate-700 dark:text-slate-300">{monthly(r.result.sustainableAnnual)}</dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Projected savings balance by age, ${startAge} to ${LIFE_EXPECTANCY}`}
      >
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} className="stroke-slate-300 dark:stroke-slate-700" />
        {plan.retirementAge > startAge && (
          <>
            <line
              x1={x(plan.retirementAge)}
              x2={x(plan.retirementAge)}
              y1={pad.t}
              y2={H - pad.b}
              strokeDasharray="4 4"
              className="stroke-slate-400 dark:stroke-slate-600"
            />
            <text x={x(plan.retirementAge) + 4} y={pad.t + 9} fontSize="10" className="fill-slate-500 dark:fill-slate-400">
              Retire {Math.round(plan.retirementAge)}
            </text>
          </>
        )}
        {shown.map((r) => (
          <path key={r.s.key} d={path(r.result.points)} fill="none" stroke={r.color} strokeWidth={r.s.key === 'base' ? 2.5 : 1.75} />
        ))}
        <text x={pad.l} y={H - 6} fontSize="10" className="fill-slate-500 dark:fill-slate-400">
          Age {startAge}
        </text>
        <text x={W - pad.r} y={H - 6} fontSize="10" textAnchor="end" className="fill-slate-500 dark:fill-slate-400">
          Age {LIFE_EXPECTANCY}
        </text>
      </svg>

      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
        Simplified, constant-return projection for planning conversations, not a forecast or financial advice. Spending
        is taken at the start of each year; taxes, pensions and one-off costs are not included.
      </p>
    </div>
  );
}
