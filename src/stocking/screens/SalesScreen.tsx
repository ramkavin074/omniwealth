'use client';

import { useMemo, useState } from 'react';
import { t, unitLabel, type Lang } from '../i18n';
import { saleLineTotal, type Sale, type TenderType } from '../types';
import { daySummary, refundSale, refundsFor, voidSale } from '../db/sales';
import { useLiveQuery } from '../hooks';
import { canManage, getGstConfig, getReceiptConfig } from '../settings';
import { printReceipt } from '../print';
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
  const [refunding, setRefunding] = useState<Sale | null>(null);
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

  if (refunding) {
    return (
      <RefundView
        lang={lang}
        sale={refunding}
        onDone={() => {
          setRefunding(null);
          setOpen(null);
        }}
        onBack={() => setRefunding(null)}
      />
    );
  }

  if (open) {
    const isRefund = !!open.refundOf;
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
                    {i.discount > 0 && (
                      <span className="text-rose-500"> −{money(i.discount)}</span>
                    )}
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
            {isRefund
              ? `${t(lang, 'sales.refundOf')} ${open.note?.replace('refund ', '') ?? ''}`
              : `${t(lang, 'sell.paid')}: ${t(lang, `sell.tender.${open.tenderType}`)}`}
            {!isRefund &&
              open.tenderType === 'split' &&
              ` (${t(lang, 'sell.tender.cash')} ${money(open.cashAmount)}` +
                (open.upiAmount ? ` · UPI ${money(open.upiAmount)}` : '') +
                (open.cardAmount
                  ? ` · ${t(lang, 'sell.tender.card')} ${money(open.cardAmount)}`
                  : '') +
                ')'}
            {open.deletedAt ? ` · ${t(lang, 'sales.voided')}` : ''}
          </p>
          {open.salesman && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t(lang, 'sell.salesman')}: {open.salesman}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            printReceipt(open, {
              lang,
              gst: getGstConfig(),
              receipt: getReceiptConfig(),
            })
          }
          className="h-11 w-full rounded-xl bg-slate-200 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
        >
          {t(lang, 'sell.print')}
        </button>

        {manage && !open.deletedAt && !isRefund && (
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setRefunding(open)}
              className="text-sm font-semibold text-teal-700 dark:text-teal-300"
            >
              {t(lang, 'sales.refund')}
            </button>
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
          </div>
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
          {summary.card > 0 &&
            ` · ${t(lang, 'sell.tender.card')} ${money(summary.card)}`}
          {summary.credit > 0 &&
            ` · ${t(lang, 'sales.credit')} ${money(summary.credit)}`}
          {summary.discountTotal > 0 &&
            ` · ${t(lang, 'sales.discounts')} ${money(summary.discountTotal)}`}
          {summary.taxCollected > 0 &&
            ` · ${t(lang, 'sales.gst')} ${money(summary.taxCollected)}`}
          {summary.refundCount > 0 && (
            <span className="text-rose-600 dark:text-rose-400">
              {' · '}
              {t(lang, 'sales.refunds')} {money(summary.refundTotal)} (
              {summary.refundCount})
            </span>
          )}
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

      {summary && summary.bySalesman.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t(lang, 'sales.bySalesman')}
          </p>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {summary.bySalesman.map((s) => (
              <li key={s.name} className="flex justify-between py-1.5 text-sm">
                <span className="text-slate-700 dark:text-slate-200">
                  {s.name}{' '}
                  <span className="text-slate-400">× {s.count}</span>
                </span>
                <span className="tabular-nums text-slate-600 dark:text-slate-300">
                  {money(s.total)}
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
                    {s.refundOf ? ` · ${t(lang, 'sales.refundTag')}` : ''}
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
                      : s.refundOf
                        ? 'text-rose-600 dark:text-rose-400'
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

function RefundView({
  lang,
  sale,
  onDone,
  onBack,
}: {
  lang: Lang;
  sale: Sale;
  onDone: () => void;
  onBack: () => void;
}) {
  const priorRefunds = useLiveQuery(() => refundsFor(sale.id), [sale.id], []);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [tender, setTender] = useState<TenderType>('cash');
  const [busy, setBusy] = useState(false);

  const already = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of priorRefunds) {
      for (const i of r.items) m[i.productId] = (m[i.productId] ?? 0) + -i.qty;
    }
    return m;
  }, [priorRefunds]);

  const rows = sale.items.map((i) => ({
    ...i,
    remaining: i.qty - (already[i.productId] ?? 0),
    picked: qty[i.productId] ?? 0,
    // per-unit price after this line's share of its discount
    effUnit:
      i.qty > 0
        ? Math.round((saleLineTotal(i) / i.qty) * 100) / 100
        : i.unitPrice,
  }));
  const estimate =
    Math.round(rows.reduce((t, r) => t + r.picked * r.effUnit, 0) * 100) / 100;

  const submit = async () => {
    setBusy(true);
    try {
      await refundSale(
        sale.id,
        rows
          .filter((r) => r.picked > 0)
          .map((r) => ({ productId: r.productId, qty: r.picked })),
        tender,
      );
      onDone();
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className={`p-4 space-y-4 ${SCREEN_PAD}`}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="font-medium text-teal-700 dark:text-teal-300"
        >
          ← {t(lang, 'sell.back')}
        </button>
        <span className="text-lg font-bold text-slate-900 dark:text-slate-50">
          {t(lang, 'sales.refund')}
        </span>
        <span className="w-6" />
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {t(lang, 'sales.refundOf')} {sale.billNo}
      </p>

      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {rows.map((r) => (
          <li key={r.productId} className="flex items-center gap-2 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-slate-900 dark:text-slate-50">
                {r.name}
              </span>
              <span className="text-xs text-slate-400">
                {t(lang, 'sales.refundLeft')} {r.remaining}{' '}
                {unitLabel(lang, r.unit)} · {money(r.unitPrice)}
              </span>
            </span>
            <button
              type="button"
              onClick={() =>
                setQty((q) => ({
                  ...q,
                  [r.productId]: Math.max(0, (q[r.productId] ?? 0) - 1),
                }))
              }
              className="h-9 w-9 rounded-lg bg-slate-200 text-lg font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
            >
              −
            </button>
            <span className="w-6 text-center tabular-nums">{r.picked}</span>
            <button
              type="button"
              onClick={() =>
                setQty((q) => ({
                  ...q,
                  [r.productId]: Math.min(
                    r.remaining,
                    (q[r.productId] ?? 0) + 1,
                  ),
                }))
              }
              disabled={r.remaining <= 0}
              className="h-9 w-9 rounded-lg bg-slate-200 text-lg font-bold text-slate-700 disabled:opacity-40 dark:bg-slate-700 dark:text-slate-100"
            >
              +
            </button>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-4 gap-2">
        {(['cash', 'upi', 'card', 'split'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTender(k)}
            className={`h-10 rounded-xl text-sm font-semibold transition ${
              tender === k
                ? 'bg-teal-700 text-white'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            {t(lang, `sell.tender.${k}`)}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={busy || estimate <= 0}
        className="h-14 w-full rounded-xl bg-rose-600 text-lg font-bold text-white disabled:opacity-40"
      >
        {t(lang, 'sales.refundDo')} · {money(estimate)}
      </button>
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
