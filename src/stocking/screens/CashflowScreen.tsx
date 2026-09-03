'use client';

import { useState } from 'react';
import { t, type Lang } from '../i18n';
import { cashflowForecast, type CashflowForecast } from '../db/cashflow';
import { getCashflowConfig, setCashflowConfig } from '../settings';
import { useLiveQuery } from '../hooks';
import { SCREEN_PAD } from '../ui';

interface Props {
  lang: Lang;
  onClose: () => void;
}

const money = (n: number) =>
  (n < 0 ? '−₹' : '₹') +
  Math.abs(Math.round(n)).toLocaleString('en-IN');

const heading =
  'text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500';

export default function CashflowScreen({ lang, onClose }: Props) {
  const [cfg, setCfg] = useState(getCashflowConfig);

  const fc = useLiveQuery<CashflowForecast | undefined>(
    () =>
      cashflowForecast({
        horizon: 7,
        custCreditDays: cfg.custCreditDays,
        supplierCreditDays: cfg.supplierCreditDays,
      }),
    [cfg.custCreditDays, cfg.supplierCreditDays],
  );

  const patch = (p: Partial<typeof cfg>) => {
    const next = { ...cfg, ...p };
    setCfg(next);
    setCashflowConfig(next);
  };

  const maxBar = Math.max(
    1,
    ...(fc?.days ?? []).map((d) => Math.max(d.in, d.out)),
  );

  return (
    <div className={`p-4 space-y-4 ${SCREEN_PAD}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
          {t(lang, 'cf.title')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="font-medium text-teal-700 dark:text-teal-300"
        >
          {t(lang, 'settings.close')}
        </button>
      </div>

      {!fc ? (
        <p className="pt-6 text-center text-slate-400">…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/40">
              <span className={heading}>{t(lang, 'cf.in')}</span>
              <span className="mt-1 block text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                {money(fc.totalIn)}
              </span>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/40">
              <span className={heading}>{t(lang, 'cf.out')}</span>
              <span className="mt-1 block text-lg font-bold tabular-nums text-rose-700 dark:text-rose-400">
                {money(fc.totalOut)}
              </span>
            </div>
            <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
              <span className={heading}>{t(lang, 'cf.net')}</span>
              <span
                className={`mt-1 block text-lg font-bold tabular-nums ${
                  fc.net >= 0
                    ? 'text-slate-900 dark:text-slate-50'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {money(fc.net)}
              </span>
            </div>
          </div>

          {/* per-day bars */}
          <div className="flex items-end gap-1.5" style={{ height: 120 }}>
            {fc.days.map((d) => (
              <div
                key={d.date}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div className="flex w-full flex-1 items-end justify-center gap-0.5">
                  <div
                    className="w-1/2 rounded-t bg-emerald-500"
                    style={{ height: `${(d.in / maxBar) * 100}%` }}
                    title={`+${money(d.in)}`}
                  />
                  <div
                    className="w-1/2 rounded-t bg-rose-500"
                    style={{ height: `${(d.out / maxBar) * 100}%` }}
                    title={`−${money(d.out)}`}
                  />
                </div>
                <span className="text-[10px] text-slate-400">
                  {d.date.slice(5)}
                </span>
              </div>
            ))}
          </div>

          {/* items */}
          <div>
            <p className={heading}>{t(lang, 'cf.expected')}</p>
            {fc.items.length === 0 ? (
              <p className="pt-2 text-sm text-slate-500 dark:text-slate-400">
                {t(lang, 'cf.none')}
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {fc.items.map((it, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-slate-800 dark:text-slate-100">
                        {it.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        {t(lang, `cf.kind.${it.kind}`)} ·{' '}
                        {it.overdue ? t(lang, 'cf.overdue') : it.dueDate}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 font-semibold tabular-nums ${
                        it.amount >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {it.amount >= 0 ? '+' : '−'}
                      {money(Math.abs(it.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* assumptions */}
          <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <p className={heading}>{t(lang, 'cf.assume')}</p>
            <div className="flex items-center gap-2 text-sm">
              <label className="flex-1 text-slate-700 dark:text-slate-200">
                {t(lang, 'cf.custDays')}
              </label>
              <input
                inputMode="numeric"
                value={cfg.custCreditDays}
                onChange={(e) =>
                  patch({ custCreditDays: Number(e.target.value) || 1 })
                }
                className="h-9 w-16 rounded-lg border border-slate-300 bg-white px-2 text-right text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50"
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label className="flex-1 text-slate-700 dark:text-slate-200">
                {t(lang, 'cf.supDays')}
              </label>
              <input
                inputMode="numeric"
                value={cfg.supplierCreditDays}
                onChange={(e) =>
                  patch({ supplierCreditDays: Number(e.target.value) || 1 })
                }
                className="h-9 w-16 rounded-lg border border-slate-300 bg-white px-2 text-right text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50"
              />
            </div>
          </div>
          <p className="text-[11px] leading-snug text-slate-400 dark:text-slate-500">
            {t(lang, 'cf.note')}
          </p>
        </>
      )}
    </div>
  );
}
