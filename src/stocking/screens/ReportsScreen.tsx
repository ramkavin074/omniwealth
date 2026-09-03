'use client';

import { useState } from 'react';
import { t, unitLabel, type Lang } from '../i18n';
import {
  dailySales,
  deadStock,
  fastMovers,
  writeOffs,
  type DeadStock,
  type FastMover,
  type DailySale,
  type WriteOffSummary,
} from '../db/analytics';
import { expensesSummary, type ExpensesSummary } from '../db/expenses';
import { useLiveQuery } from '../hooks';
import { SCREEN_PAD } from '../ui';

interface Props {
  lang: Lang;
  onClose: () => void;
}

const money = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function ReportsScreen({ lang, onClose }: Props) {
  const [tab, setTab] = useState<'week' | 'fast' | 'dead'>('week');
  const week = useLiveQuery(() => dailySales(7), [], [] as DailySale[]);
  const fast = useLiveQuery(() => fastMovers(30), [], [] as FastMover[]);
  const dead = useLiveQuery<DeadStock | undefined>(() => deadStock(), []);
  const loss = useLiveQuery<WriteOffSummary | undefined>(() => writeOffs(30), []);
  const exp30 = useLiveQuery<ExpensesSummary | undefined>(() => {
    const now = Date.now();
    return expensesSummary(now - 30 * 86_400_000, now);
  }, []);

  const maxVal = Math.max(1, ...week.map((d) => d.value));
  const weekTotal = week.reduce((s, d) => s + d.value, 0);

  return (
    <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
          {t(lang, 'rep.title')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="font-medium text-teal-700 dark:text-teal-300"
        >
          {t(lang, 'settings.close')}
        </button>
      </div>

      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {(['week', 'fast', 'dead'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`h-9 flex-1 rounded-lg text-sm font-semibold transition ${
              tab === k
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {t(lang, `rep.${k}`)}
          </button>
        ))}
      </div>

      {tab === 'week' && (
        <div className="space-y-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t(lang, 'rep.weekTotal')}:{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {money(weekTotal)}
            </span>
          </p>
          {loss && loss.value > 0 && (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              {t(lang, 'rep.losses')}:{' '}
              <span className="font-semibold">−{money(loss.value)}</span>
            </p>
          )}
          {exp30 && exp30.total > 0 && (
            <div className="text-sm text-slate-600 dark:text-slate-300">
              <span>
                {t(lang, 'exp.month')}:{' '}
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  −{money(exp30.total)}
                </span>
              </span>
              {exp30.byCategory.length > 0 && (
                <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">
                  ({exp30.byCategory
                    .slice(0, 3)
                    .map(
                      (c) =>
                        `${t(lang, `exp.cat.${c.category}`)} ${money(c.amount)}`,
                    )
                    .join(', ')})
                </span>
              )}
            </div>
          )}
          <div className="flex items-end gap-2 h-40">
            {week.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex-1 flex w-full items-end">
                  <div
                    className="w-full rounded-t bg-teal-600"
                    style={{ height: `${(d.value / maxVal) * 100}%` }}
                    title={money(d.value)}
                  />
                </div>
                <span className="text-[10px] text-slate-400">
                  {d.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'fast' && (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {fast.length === 0 && (
            <p className="pt-4 text-center text-slate-500 dark:text-slate-400">
              {t(lang, 'rep.noSales')}
            </p>
          )}
          {fast.map((f, i) => (
            <li
              key={f.product.id}
              className="flex items-center justify-between py-2.5"
            >
              <span className="min-w-0">
                <span className="block truncate text-slate-900 dark:text-slate-50">
                  {i + 1}. {f.product.name}
                </span>
                <span className="text-xs text-slate-400">
                  {money(f.valueSold)}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                {f.unitsSold} {unitLabel(lang, f.product.unit)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {tab === 'dead' && (
        <div className="space-y-3">
          {(dead?.buckets ?? []).every((b) => b.products.length === 0) && (
            <p className="pt-4 text-center text-slate-500 dark:text-slate-400">
              {t(lang, 'rep.noDead')}
            </p>
          )}
          {(dead?.buckets ?? []).map(
            (b) =>
              b.products.length > 0 && (
                <div key={b.days}>
                  <p className="mb-1 text-xs font-semibold uppercase text-amber-700 dark:text-amber-400">
                    {t(lang, 'rep.noSaleIn').replace('{d}', String(b.days))}
                  </p>
                  <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                    {b.products.map((p) => (
                      <li
                        key={p.id}
                        className="flex justify-between py-2 text-sm"
                      >
                        <span className="text-slate-700 dark:text-slate-200">
                          {p.name}
                        </span>
                        <span className="text-slate-400">
                          {p.stockQty} {unitLabel(lang, p.unit)} ·{' '}
                          {money(p.stockQty * p.price)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
          )}
        </div>
      )}

      <p className="pt-2 text-xs text-slate-400 dark:text-slate-500">
        {t(lang, 'rep.note')}
      </p>
    </div>
  );
}
