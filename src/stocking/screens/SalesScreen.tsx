'use client';

import { useState } from 'react';
import { t, unitLabel, type Lang } from '../i18n';
import { saleLineTotal, type Sale } from '../types';
import { daySummary, voidSale } from '../db/sales';
import { useLiveQuery } from '../hooks';
import { canManage } from '../settings';
import { SCREEN_PAD } from '../ui';

interface Props {
  lang: Lang;
  onClose: () => void;
}

const money = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const money2 = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

// 0 = today, 1 = yesterday, 7 = last 7 days
const RANGES = [0, 1, 7] as const;

export default function SalesScreen({ lang, onClose }: Props) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(0);
  const [open, setOpen] = useState<Sale | null>(null);
  const [manage] = useState(canManage);

  const summary = useLiveQuery(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (range === 1) {
      const from = start.getTime() - 86_400_000;
      return daySummary(from, start.getTime());
    }
    if (range === 7) {
      return daySummary(start.getTime() - 6 * 86_400_000, start.getTime() + 86_400_000);
    }
    return daySummary();
  }, [range]);

  if (open) {
    return (
      <div className={`p-4 space-y-4 ${SCREEN_PAD}`}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="font-medium text-teal-700 dark:text-teal-300"
          >
            ← {t(lang, 'sell.back')}
          </button>
          <span className="font-mono font-bold text-slate-900 dark:text-slate-50">
            {open.billNo}
          </span>
          <span className="w-6" />
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xs text-slate-400">
            {new Date(open.createdAt).toLocaleString('en-IN')}
          </p>
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {open.items.map((i) => (
              <li key={i.productId} className="flex justify-between py-1.5 text-sm">
                <span className="text-slate-700 dark:text-slate-200">
                  {i.name}{' '}
                  <span className="text-slate-400">
                    {i.qty} {unitLabel(lang, i.unit)} × {money(i.unitPrice)}
                  </span>
                </span>
                <span className="tabular-nums text-slate-800 dark:text-slate-100">
                  {money(saleLineTotal(i))}
                </span>
              </li>
            ))}
          </ul>
          {open.discount > 0 && (
            <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-sm text-rose-600 dark:border-slate-700 dark:text-rose-400">
              <span>{t(lang, 'sell.discount')}</span>
              <span className="tabular-nums">−{money(open.discount)}</span>
            </div>
          )}
          {(open.taxBreakup ?? []).length > 0 && (
            <div className="mt-2 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
              {open.taxBreakup.map((r) => (
                <div key={r.rate} className="flex justify-between">
                  <span>GST {r.rate}%</span>
                  <span className="tabular-nums">
                    CGST {money2(r.cgst)} · SGST {money2(r.sgst)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div
            className={`mt-2 flex justify-between ${
              open.discount > 0 || (open.taxBreakup ?? []).length > 0
                ? ''
                : 'border-t border-slate-200 pt-2 dark:border-slate-700'
            } font-bold text-slate-900 dark:text-slate-50`}
          >
            <span>{t(lang, 'sell.total')}</span>
            <span className="tabular-nums">{money(open.total)}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t(lang, 'sell.paid')}: {t(lang, `sell.tender.${open.tenderType}`)}
            {open.deletedAt ? ` · ${t(lang, 'sales.voided')}` : ''}
          </p>
        </div>

        {manage && !open.deletedAt && (
          <button
            type="button"
            onClick={async () => {
              if (confirm(t(lang, 'sales.voidConfirm'))) {
                await voidSale(open.id);
                setOpen(null);
              }
            }}
            className="text-sm font-medium text-rose-600 dark:text-rose-400"
          >
            {t(lang, 'sales.void')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
          {t(lang, 'sales.title')}
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
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`h-9 flex-1 rounded-lg text-sm font-semibold transition ${
              range === r
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {t(lang, `sales.range.${r}`)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Tile label={t(lang, 'sales.total')} value={money(summary?.total ?? 0)} big />
        <Tile label={t(lang, 'sales.bills')} value={String(summary?.count ?? 0)} />
        <Tile
          label={`${t(lang, 'sell.tender.cash')} / ${t(lang, 'sell.tender.upi')}`}
          value={`${money(summary?.cash ?? 0)} / ${money(summary?.upi ?? 0)}`}
        />
      </div>

      {summary && summary.count > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t(lang, 'sales.avgBill')} {money(summary.avgBill)}
          {summary.discountTotal > 0 &&
            ` · ${t(lang, 'sales.discounts')} ${money(summary.discountTotal)}`}
          {summary.taxCollected > 0 &&
            ` · ${t(lang, 'sales.gst')} ${money(summary.taxCollected)}`}
        </p>
      )}

      {summary && summary.topItems.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t(lang, 'sales.topItems')}
          </p>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {summary.topItems.map((it) => (
              <li
                key={it.name}
                className="flex justify-between py-1.5 text-sm"
              >
                <span className="text-slate-700 dark:text-slate-200">
                  {it.name}{' '}
                  <span className="text-slate-400">× {it.qty}</span>
                </span>
                <span className="tabular-nums text-slate-600 dark:text-slate-300">
                  {money(it.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!summary || summary.sales.length === 0 ? (
        <p className="pt-6 text-center text-slate-500 dark:text-slate-400">
          {t(lang, 'sales.none')}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {summary.sales.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setOpen(s)}
                className="flex w-full items-center justify-between py-2.5 text-left"
              >
                <span className="min-w-0">
                  <span className="block font-mono text-sm text-slate-900 dark:text-slate-50">
                    {s.billNo}
                    {s.deletedAt ? ` · ${t(lang, 'sales.voided')}` : ''}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(s.createdAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · {s.items.length} · {t(lang, `sell.tender.${s.tenderType}`)}
                  </span>
                </span>
                <span
                  className={`shrink-0 font-semibold tabular-nums ${
                    s.deletedAt
                      ? 'text-slate-400 line-through'
                      : 'text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {money(s.total)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  big,
}: {
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
      <span className="block text-xs text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span
        className={`block font-bold tabular-nums text-slate-900 dark:text-slate-50 ${
          big ? 'text-lg' : 'text-sm'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
