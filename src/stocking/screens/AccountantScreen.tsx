'use client';

import { useEffect, useState } from 'react';
import { t, type Lang } from '../i18n';
import {
  buildAccountantExport,
  resolveRange,
  type AccountantExport,
  type RangeKind,
} from '../db/accountant';
import { buildAccountantCsv, buildTallyXml, downloadFile } from '../export';
import { getGstConfig } from '../settings';
import { SCREEN_PAD } from '../ui';

interface Props {
  lang: Lang;
  onClose: () => void;
}

const money = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const RANGES: RangeKind[] = [
  'this-month',
  'last-month',
  'this-quarter',
  'this-fy',
  'custom',
];

export default function AccountantScreen({ lang, onClose }: Props) {
  const gstOn = getGstConfig().enabled;
  const [kind, setKind] = useState<RangeKind>('this-month');
  const [fromISO, setFromISO] = useState('');
  const [toISO, setToISO] = useState('');
  const [data, setData] = useState<AccountantExport | null>(null);

  const range = resolveRange(kind, fromISO || undefined, toISO || undefined);
  const loading =
    !data || data.range.from !== range.from || data.range.to !== range.to;

  useEffect(() => {
    let alive = true;
    const r = resolveRange(kind, fromISO || undefined, toISO || undefined);
    buildAccountantExport(r).then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [kind, fromISO, toISO]);

  const slug = data
    ? data.range.label.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '')
    : 'export';

  return (
    <div className={`p-4 space-y-4 md:mx-auto md:max-w-2xl ${SCREEN_PAD}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
          {t(lang, 'acct.title')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="font-medium text-teal-700 dark:text-teal-300"
        >
          {t(lang, 'settings.close')}
        </button>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        {t(lang, 'acct.help')}
      </p>

      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setKind(r)}
            className={`h-9 rounded-lg px-3 text-sm font-semibold ${
              kind === r
                ? 'bg-teal-700 text-white'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            {t(lang, `acct.range.${r}`)}
          </button>
        ))}
      </div>

      {kind === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fromISO}
            onChange={(e) => setFromISO(e.target.value)}
            className="h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50"
          />
          <span className="text-slate-400">→</span>
          <input
            type="date"
            value={toISO}
            onChange={(e) => setToISO(e.target.value)}
            className="h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50"
          />
        </div>
      )}

      {loading || !data ? (
        <p className="text-slate-500 dark:text-slate-400">
          {t(lang, 'acct.building')}
        </p>
      ) : (
        <>
          <div className="space-y-1 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
            <p className="mb-1 font-semibold text-slate-900 dark:text-slate-50">
              {data.range.label}
            </p>
            <Line
              label={t(lang, 'acct.turnover')}
              value={money(data.summary.turnover)}
            />
            <Line
              label={t(lang, 'acct.purchases')}
              value={money(data.summary.purchaseTotal)}
            />
            <Line
              label={t(lang, 'acct.expenses')}
              value={money(data.summary.expenseTotal)}
            />
            {gstOn && (
              <>
                <Line
                  label={t(lang, 'acct.gstOut')}
                  value={money(data.summary.gstOutputTotal)}
                />
                <Line
                  label={t(lang, 'acct.gstIn')}
                  value={'−' + money(data.summary.gstInputTotal)}
                />
                <Line
                  label={t(lang, 'acct.gstNet')}
                  value={money(data.summary.netGstPayable)}
                  bold
                />
              </>
            )}
            <Line
              label={t(lang, 'acct.grossProfit')}
              value={money(data.summary.grossProfitApprox)}
            />
            <Line
              label={t(lang, 'acct.receivables')}
              value={money(data.summary.receivablesNow)}
            />
            <Line
              label={t(lang, 'acct.payables')}
              value={money(data.summary.payablesNow)}
            />
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500">
            {t(lang, 'acct.counts')
              .replace('{s}', String(data.sales.length))
              .replace('{p}', String(data.purchases.length))
              .replace('{e}', String(data.expenses.length))}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                downloadFile(`kadai-accounts-${slug}.csv`, buildAccountantCsv(data))
              }
              className="h-12 rounded-xl bg-teal-700 font-semibold text-white"
            >
              {t(lang, 'acct.csv')}
            </button>
            <button
              type="button"
              onClick={() =>
                downloadFile(
                  `kadai-tally-${slug}.xml`,
                  buildTallyXml(data),
                  'application/xml',
                )
              }
              className="h-12 rounded-xl bg-slate-200 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
            >
              {t(lang, 'acct.tally')}
            </button>
          </div>

          <p className="text-[11px] leading-snug text-slate-400 dark:text-slate-500">
            {t(lang, 'acct.disclaimer')}
          </p>
        </>
      )}
    </div>
  );
}

function Line({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${
        bold
          ? 'font-semibold text-slate-900 dark:text-slate-50'
          : 'text-slate-600 dark:text-slate-300'
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
