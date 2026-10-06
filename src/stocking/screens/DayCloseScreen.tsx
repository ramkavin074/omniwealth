'use client';

import { useEffect, useState } from 'react';
import { t, type Lang } from '../i18n';
import { SHEET_OVERLAY, SHEET_PANEL } from '../ui';
import { dayFigures, listCloses, saveClose, type DayFigures } from '../db/dayclose';
import { useBackHandler, useLiveQuery } from '../hooks';
import { todayISO } from '../types';
import { expectedCash, cashDifference } from '@/lib/dayClose';

const money = (n: number) =>
  (n < 0 ? '−₹' : '₹') + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const field =
  'h-11 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-slate-900 dark:text-slate-50';

export default function DayCloseScreen({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  useBackHandler(true, () => {
    onClose();
    return true;
  });
  const [date, setDate] = useState(todayISO());
  const [opening, setOpening] = useState('');
  const [other, setOther] = useState('');
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  const fig = useLiveQuery<DayFigures | undefined>(() => dayFigures(date), [date]);
  const history = useLiveQuery(() => listCloses(14), [], []);

  // Fill the form from an existing close for that day, else from the usual opening float.
  const figKey = fig ? `${fig.date}:${fig.existing?.id ?? ''}` : '';
  useEffect(() => {
    if (!fig) return;
    const e = fig.existing;
    setOpening(String(e ? e.openingCash : fig.suggestedOpening || ''));
    setOther(e && e.otherPaidOut ? String(e.otherPaidOut) : '');
    setCounted(e ? String(e.countedCash) : '');
    setNote(e?.note ?? '');
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fill only when the day (or its saved close) changes
  }, [figKey]);

  const exp = fig
    ? expectedCash({
        openingCash: Number(opening) || 0,
        cashSales: fig.cashSales,
        cashReceived: fig.cashReceived,
        cashExpenses: fig.cashExpenses,
        otherPaidOut: Number(other) || 0,
      })
    : 0;
  const hasCount = counted.trim() !== '' && Number.isFinite(Number(counted));
  const diff = hasCount ? cashDifference(Number(counted), exp) : 0;

  const save = async () => {
    if (!hasCount) return;
    await saveClose({
      date,
      openingCash: Number(opening) || 0,
      otherPaidOut: Number(other) || 0,
      countedCash: Number(counted),
      note,
    });
    setSaved(true);
  };

  const row = (label: string, value: number, sign?: '+' | '−') => (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-slate-600 dark:text-slate-300">
        {sign ? `${sign} ` : ''}
        {label}
      </span>
      <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">{money(value)}</span>
    </div>
  );

  return (
    <div className={`${SHEET_OVERLAY} z-40`}>
      <div
        className={`${SHEET_PANEL} max-h-[92vh] space-y-3 overflow-y-auto md:max-w-2xl`}
        style={{ paddingBottom: 'calc(1rem + var(--app-safe-bottom))' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{t(lang, 'dc.title')}</h2>
          <button type="button" onClick={onClose} className="font-medium text-teal-700 dark:text-teal-300">
            {t(lang, 'settings.close')}
          </button>
        </div>

        <input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className={`${field} w-full`}
          aria-label={t(lang, 'dc.date')}
        />
        {fig?.existing && (
          <p className="text-xs text-emerald-700 dark:text-emerald-400">{t(lang, 'dc.alreadyClosed')}</p>
        )}

        <label className="block">
          <span className="text-xs text-slate-500 dark:text-slate-400">{t(lang, 'dc.opening')}</span>
          <input
            inputMode="decimal"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            className={`${field} w-full`}
          />
        </label>

        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 px-3 dark:divide-slate-800 dark:border-slate-800">
          {row(t(lang, 'dc.cashSales'), fig?.cashSales ?? 0, '+')}
          {row(t(lang, 'dc.cashReceived'), fig?.cashReceived ?? 0, '+')}
          {row(t(lang, 'dc.cashExpenses'), fig?.cashExpenses ?? 0, '−')}
        </div>

        <label className="block">
          <span className="text-xs text-slate-500 dark:text-slate-400">{t(lang, 'dc.other')}</span>
          <input
            inputMode="decimal"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            className={`${field} w-full`}
          />
        </label>

        <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
          <span className="font-semibold text-slate-700 dark:text-slate-200">{t(lang, 'dc.expected')}</span>
          <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">{money(exp)}</span>
        </div>

        <label className="block">
          <span className="text-xs text-slate-500 dark:text-slate-400">{t(lang, 'dc.counted')}</span>
          <input
            inputMode="decimal"
            value={counted}
            onChange={(e) => {
              setCounted(e.target.value);
              setSaved(false);
            }}
            className={`${field} w-full text-lg`}
          />
        </label>

        {hasCount && (
          <p
            className={`text-center text-lg font-bold ${
              Math.abs(diff) < 0.01
                ? 'text-emerald-600 dark:text-emerald-400'
                : diff < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {Math.abs(diff) < 0.01
              ? t(lang, 'dc.square')
              : diff < 0
                ? t(lang, 'dc.short').replace('{amt}', money(-diff))
                : t(lang, 'dc.over').replace('{amt}', money(diff))}
          </p>
        )}

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t(lang, 'adjust.note')}
          className={`${field} w-full`}
        />

        <button
          type="button"
          onClick={save}
          disabled={!hasCount}
          className="h-12 w-full rounded-xl bg-teal-700 font-bold text-white disabled:opacity-40"
        >
          {saved ? t(lang, 'dc.saved') : t(lang, fig?.existing ? 'dc.update' : 'dc.save')}
        </button>

        {history.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {t(lang, 'dc.history')}
            </p>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {history.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setDate(c.date)}
                    className="flex w-full items-center justify-between py-2 text-left text-sm"
                  >
                    <span className="text-slate-700 dark:text-slate-200">{c.date}</span>
                    <span className="tabular-nums text-slate-500 dark:text-slate-400">{money(c.countedCash)}</span>
                    <span
                      className={`w-24 text-right font-semibold tabular-nums ${
                        Math.abs(c.difference) < 0.01
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : c.difference < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {Math.abs(c.difference) < 0.01 ? '✓' : (c.difference > 0 ? '+' : '−') + money(Math.abs(c.difference)).replace('₹', '₹')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
