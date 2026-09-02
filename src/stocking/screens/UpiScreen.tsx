'use client';

import { useMemo, useState } from 'react';
import { t, type Lang } from '../i18n';
import type { Sale, UpiReceipt } from '../types';
import {
  addReceipt,
  addReceipts,
  autoMatch,
  reconcile,
  softDeleteReceipt,
  updateReceipt,
  type Reconciliation,
} from '../db/upi';
import { parseUpiHistory } from '../parseDoc';
import { useLiveQuery } from '../hooks';
import { SCREEN_PAD } from '../ui';

interface Props {
  lang: Lang;
  onClose: () => void;
}

const money = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const money2 = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

const inputCls =
  'h-11 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-slate-900 dark:text-slate-50';

const RANGES = [0, 1, 7] as const;

export default function UpiScreen({ lang, onClose }: Props) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [addAmt, setAddAmt] = useState('');
  const [linkFor, setLinkFor] = useState<UpiReceipt | null>(null);

  const bounds = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (range === 1) {
      return { from: start.getTime() - 86_400_000, to: start.getTime() };
    }
    if (range === 7) {
      return {
        from: start.getTime() - 6 * 86_400_000,
        to: start.getTime() + 86_400_000,
      };
    }
    return { from: start.getTime(), to: start.getTime() + 86_400_000 };
  }, [range]);

  const rec = useLiveQuery<Reconciliation | undefined>(
    () => reconcile(bounds.from, bounds.to),
    [bounds.from, bounds.to],
  );

  const flash = (s: string) => {
    setMsg(s);
    setTimeout(() => setMsg(null), 2500);
  };

  const scan = async (file: File) => {
    setBusy(true);
    try {
      const rows = await parseUpiHistory(file);
      if (rows.length === 0) {
        flash(t(lang, 'upi.scanNothing'));
        return;
      }
      const n = await addReceipts(
        rows.map((r) => ({
          amount: r.amount,
          receivedAt: r.receivedAt ?? Date.now(),
          ref: r.ref ?? null,
          payerName: r.payer ?? null,
          source: 'photo' as const,
        })),
      );
      await autoMatch(bounds.from, bounds.to);
      flash(t(lang, 'upi.scanAdded').replace('{n}', String(n)));
    } catch {
      flash(t(lang, 'upi.scanFailed'));
    } finally {
      setBusy(false);
    }
  };

  const addManual = async () => {
    const amt = Number(addAmt);
    if (!(amt > 0)) return;
    await addReceipt({ amount: amt, source: 'manual' });
    await autoMatch(bounds.from, bounds.to);
    setAddAmt('');
  };

  const runMatch = async () => {
    setBusy(true);
    const n = await autoMatch(bounds.from, bounds.to);
    setBusy(false);
    flash(t(lang, 'upi.matched').replace('{n}', String(n)));
  };

  const diffColor =
    rec && Math.abs(rec.difference) < 0.01
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-rose-600 dark:text-rose-400';

  return (
    <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
          {t(lang, 'upi.title')}
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

      {rec && (
        <div className="rounded-2xl border border-slate-200 p-4 text-center dark:border-slate-800">
          <div className="flex justify-around text-sm">
            <span>
              <span className="block text-xs text-slate-400">
                {t(lang, 'upi.appSays')}
              </span>
              <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {money(rec.appUpiTotal)}
              </span>
            </span>
            <span>
              <span className="block text-xs text-slate-400">
                {t(lang, 'upi.received')}
              </span>
              <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {money(rec.receivedTotal)}
              </span>
            </span>
          </div>
          <p className={`mt-2 text-lg font-bold ${diffColor}`}>
            {t(lang, 'upi.difference')} {money2(rec.difference)}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="flex h-11 cursor-pointer items-center justify-center rounded-xl bg-teal-700 text-sm font-semibold text-white">
          {busy ? '…' : t(lang, 'upi.scan')}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) scan(f);
              e.currentTarget.value = '';
            }}
          />
        </label>
        <button
          type="button"
          onClick={runMatch}
          disabled={busy}
          className="h-11 rounded-xl bg-slate-200 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
        >
          {t(lang, 'upi.rematch')}
        </button>
      </div>

      <div className="flex gap-2">
        <input
          inputMode="decimal"
          value={addAmt}
          onChange={(e) => setAddAmt(e.target.value)}
          placeholder={t(lang, 'upi.addManual')}
          className={`${inputCls} flex-1`}
        />
        <button
          type="button"
          onClick={addManual}
          className="h-11 rounded-lg bg-slate-200 px-4 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
        >
          {t(lang, 'upi.addBtn')}
        </button>
      </div>

      {msg && (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {msg}
        </p>
      )}

      {rec && rec.unmatchedSales.length > 0 && (
        <Section title={t(lang, 'upi.unmatchedBills')} warn>
          {rec.unmatchedSales.map((s) => (
            <Row
              key={s.id}
              left={`${s.billNo} · ${clock(s.createdAt)}`}
              right={money(s.upiAmount)}
              rose
            />
          ))}
        </Section>
      )}

      {rec && rec.unmatchedReceipts.length > 0 && (
        <Section title={t(lang, 'upi.unmatchedReceipts')}>
          {rec.unmatchedReceipts.map((r) => (
            <div key={r.id} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="flex-1">
                <span className="block text-slate-800 dark:text-slate-100">
                  {money(r.amount)}{' '}
                  <span className="text-xs text-slate-400">
                    {clock(r.receivedAt)}
                    {r.payerName ? ` · ${r.payerName}` : ''}
                  </span>
                </span>
              </span>
              <button
                type="button"
                onClick={() => setLinkFor(r)}
                className="rounded-lg bg-slate-200 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-200"
              >
                {t(lang, 'upi.link')}
              </button>
              <button
                type="button"
                onClick={() => softDeleteReceipt(r.id)}
                className="text-slate-400"
                aria-label="delete"
              >
                ✕
              </button>
            </div>
          ))}
        </Section>
      )}

      {rec && rec.matched.length > 0 && (
        <Section title={t(lang, 'upi.matched2')}>
          {rec.matched.map(({ sale, receipt }) => (
            <Row
              key={receipt.id}
              left={`${sale.billNo} ✓ ${clock(receipt.receivedAt)}`}
              right={money(receipt.amount)}
            />
          ))}
        </Section>
      )}

      {linkFor && rec && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/40 md:items-center md:justify-center">
          <div className="mx-auto w-full max-w-md rounded-t-2xl bg-white p-4 dark:bg-slate-900 md:rounded-2xl">
            <p className="mb-2 font-semibold text-slate-900 dark:text-slate-50">
              {t(lang, 'upi.linkTo')} {money(linkFor.amount)}
            </p>
            <ul className="max-h-72 divide-y divide-slate-200 overflow-y-auto dark:divide-slate-800">
              {rec.unmatchedSales.map((s: Sale) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateReceipt(linkFor.id, { matchedSaleId: s.id });
                      setLinkFor(null);
                    }}
                    className="flex w-full justify-between py-2.5 text-left text-sm"
                  >
                    <span>
                      {s.billNo} · {clock(s.createdAt)}
                    </span>
                    <span className="tabular-nums">{money(s.upiAmount)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setLinkFor(null)}
              className="mt-3 h-10 w-full rounded-xl bg-slate-200 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
            >
              {t(lang, 'product.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  warn,
  children,
}: {
  title: string;
  warn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className={`mb-1 text-xs font-semibold uppercase tracking-wide ${
          warn
            ? 'text-rose-600 dark:text-rose-400'
            : 'text-slate-400 dark:text-slate-500'
        }`}
      >
        {title}
      </p>
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {children}
      </div>
    </div>
  );
}

function Row({
  left,
  right,
  rose,
}: {
  left: string;
  right: string;
  rose?: boolean;
}) {
  return (
    <div className="flex justify-between py-2 text-sm">
      <span className="font-mono text-slate-700 dark:text-slate-200">{left}</span>
      <span
        className={`tabular-nums font-semibold ${
          rose
            ? 'text-rose-600 dark:text-rose-400'
            : 'text-slate-800 dark:text-slate-100'
        }`}
      >
        {right}
      </span>
    </div>
  );
}
