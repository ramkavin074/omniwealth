'use client';

import { useMemo, useState } from 'react';
import { t, unitLabel, type Lang } from '../i18n';
import {
  listPurchases,
  recordPurchase,
  softDeletePurchase,
  purchasesSummary,
} from '../db/purchases';
import { createSupplier, listSuppliers } from '../db/suppliers';
import {
  GST_RATES,
  purchaseBalance,
  purchaseLineTax,
  purchaseLineValue,
  todayISO,
  type Purchase,
} from '../types';
import { useLiveQuery } from '../hooks';
import { getGstConfig } from '../settings';
import { SCREEN_PAD } from '../ui';

interface Props {
  lang: Lang;
  onClose: () => void;
}

const field =
  'w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-slate-900 dark:text-slate-50';

const money = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

interface DraftLine {
  name: string;
  qty: string;
  cost: string;
  gst: number;
}

const blankLine = (gst: number): DraftLine => ({
  name: '',
  qty: '1',
  cost: '',
  gst,
});

export default function PurchasesScreen({ lang, onClose }: Props) {
  const rows = useLiveQuery(() => listPurchases(300), [], [] as Purchase[]);
  const suppliers = useLiveQuery(() => listSuppliers(), [], []);
  const summary = useLiveQuery(() => purchasesSummary(), [], {
    from: 0,
    to: 0,
    count: 0,
    subtotal: 0,
    gstInput: 0,
    total: 0,
    unpaid: 0,
  });
  const gst = useMemo(() => getGstConfig(), []);
  const defaultGst = gst.enabled ? gst.defaultRate : 0;

  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'form'>('list');

  // form
  const [supId, setSupId] = useState('');
  const [newSup, setNewSup] = useState(false);
  const [nsName, setNsName] = useState('');
  const [invNo, setInvNo] = useState('');
  const [invDate, setInvDate] = useState(todayISO());
  const [lines, setLines] = useState<DraftLine[]>([blankLine(defaultGst)]);
  const [paid, setPaid] = useState('');
  const [pNote, setPNote] = useState('');
  const [busy, setBusy] = useState(false);

  const current = useMemo(
    () => rows.find((p) => p.id === sel) ?? null,
    [rows, sel],
  );

  const calc = useMemo(() => {
    let subtotal = 0;
    let gstInput = 0;
    for (const l of lines) {
      const qty = Number(l.qty) || 0;
      const cost = Number(l.cost) || 0;
      if (qty <= 0 || cost < 0) continue;
      subtotal += purchaseLineValue({ qty, costPrice: cost });
      gstInput += purchaseLineTax(
        { qty, costPrice: cost, gstRate: l.gst },
        gst.enabled,
      );
    }
    subtotal = Math.round(subtotal * 100) / 100;
    gstInput = Math.round(gstInput * 100) / 100;
    return { subtotal, gstInput, total: Math.round((subtotal + gstInput) * 100) / 100 };
  }, [lines, gst.enabled]);

  const resetForm = () => {
    setSupId('');
    setNewSup(false);
    setNsName('');
    setInvNo('');
    setInvDate(todayISO());
    setLines([blankLine(defaultGst)]);
    setPaid('');
    setPNote('');
  };

  const header = (title: string, back: () => void) => (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={back}
        className="font-medium text-teal-700 dark:text-teal-300"
      >
        ←
      </button>
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
        {title}
      </h2>
      <span className="w-6" />
    </div>
  );

  // ---- new purchase ----
  if (mode === 'form') {
    const cleanLines = lines.filter(
      (l) => l.name.trim() && Number(l.qty) > 0,
    );
    const canSave =
      cleanLines.length > 0 && (newSup ? nsName.trim().length > 0 : !!supId);

    const submit = async () => {
      if (!canSave || busy) return;
      setBusy(true);
      try {
        let supplierId = supId;
        let supplierName =
          suppliers.find((s) => s.id === supId)?.name ?? '';
        if (newSup) {
          const s = await createSupplier({ name: nsName });
          supplierId = s.id;
          supplierName = s.name;
        }
        await recordPurchase({
          invoiceNo: invNo,
          supplierId,
          supplierName,
          invoiceDate: invDate || undefined,
          lines: cleanLines.map((l) => ({
            name: l.name,
            qty: Number(l.qty) || 0,
            costPrice: Number(l.cost) || 0,
            gstRate: l.gst,
          })),
          paid: Number(paid) || 0,
          note: pNote,
        });
        resetForm();
        setMode('list');
      } catch {
        setBusy(false);
      }
    };

    return (
      <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
        {header(t(lang, 'pur.new'), () => {
          resetForm();
          setMode('list');
        })}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t(lang, 'pur.supplier')}
          </p>
          {!newSup ? (
            <>
              <select
                value={supId}
                onChange={(e) => setSupId(e.target.value)}
                className={field}
              >
                <option value="">{t(lang, 'pur.pickSupplier')}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setNewSup(true);
                  setSupId('');
                }}
                className="text-sm font-medium text-teal-700 dark:text-teal-300"
              >
                {t(lang, 'pur.newSupplier')}
              </button>
            </>
          ) : (
            <>
              <input
                autoFocus
                value={nsName}
                onChange={(e) => setNsName(e.target.value)}
                placeholder={t(lang, 'sup.name')}
                className={field}
              />
              <button
                type="button"
                onClick={() => setNewSup(false)}
                className="text-sm font-medium text-teal-700 dark:text-teal-300"
              >
                {t(lang, 'pur.pickSupplier')}
              </button>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input
            value={invNo}
            onChange={(e) => setInvNo(e.target.value)}
            placeholder={t(lang, 'pur.invoiceNo')}
            className={field}
          />
          <input
            type="date"
            value={invDate}
            max={todayISO()}
            onChange={(e) => setInvDate(e.target.value)}
            className={field}
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t(lang, 'pur.lines')}
          </p>
          {lines.map((l, i) => (
            <div
              key={i}
              className="space-y-1.5 rounded-lg bg-slate-100 p-2 dark:bg-slate-800"
            >
              <input
                value={l.name}
                onChange={(e) => {
                  const next = [...lines];
                  next[i] = { ...l, name: e.target.value };
                  setLines(next);
                }}
                placeholder={t(lang, 'pur.item')}
                className={field}
              />
              <div className="flex items-center gap-2">
                <input
                  value={l.qty}
                  onChange={(e) => {
                    const next = [...lines];
                    next[i] = { ...l, qty: e.target.value };
                    setLines(next);
                  }}
                  inputMode="decimal"
                  placeholder={t(lang, 'pur.qty')}
                  className={`${field} flex-1`}
                />
                <span className="text-slate-400">×</span>
                <input
                  value={l.cost}
                  onChange={(e) => {
                    const next = [...lines];
                    next[i] = { ...l, cost: e.target.value };
                    setLines(next);
                  }}
                  inputMode="decimal"
                  placeholder={t(lang, 'pur.cost')}
                  className={`${field} flex-1`}
                />
                {gst.enabled && (
                  <select
                    value={String(l.gst)}
                    onChange={(e) => {
                      const next = [...lines];
                      next[i] = { ...l, gst: Number(e.target.value) };
                      setLines(next);
                    }}
                    className={`${field} w-20`}
                  >
                    {GST_RATES.map((r) => (
                      <option key={r} value={r}>
                        {r}%
                      </option>
                    ))}
                  </select>
                )}
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLines(lines.filter((_, j) => j !== i))}
                    className="shrink-0 px-1 text-lg text-rose-500"
                    aria-label="remove line"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLines([...lines, blankLine(defaultGst)])}
            className="text-sm font-medium text-teal-700 dark:text-teal-300"
          >
            {t(lang, 'pur.addLine')}
          </button>
        </div>

        <div className="space-y-1 rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>{t(lang, 'pur.subtotal')}</span>
            <span className="tabular-nums">{money(calc.subtotal)}</span>
          </div>
          {gst.enabled && (
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>{t(lang, 'pur.gstInput')}</span>
              <span className="tabular-nums">{money(calc.gstInput)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-900 dark:text-slate-50">
            <span>{t(lang, 'pur.total')}</span>
            <span className="tabular-nums">{money(calc.total)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 dark:text-slate-300">
            {t(lang, 'pur.paid')}
          </label>
          <input
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            className={`${field} flex-1`}
          />
          <button
            type="button"
            onClick={() => setPaid(String(calc.total))}
            className="shrink-0 rounded-lg bg-slate-200 px-3 py-2 text-sm font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            {t(lang, 'pur.payFull')}
          </button>
        </div>

        <input
          value={pNote}
          onChange={(e) => setPNote(e.target.value)}
          placeholder={t(lang, 'adjust.note')}
          className={field}
        />

        <button
          type="button"
          onClick={submit}
          disabled={!canSave || busy}
          className="h-12 w-full rounded-xl bg-teal-700 font-bold text-white disabled:opacity-40"
        >
          {t(lang, 'product.save')}
        </button>
      </div>
    );
  }

  // ---- detail ----
  if (sel && current) {
    const p = current;
    const bal = purchaseBalance(p);
    return (
      <div className={`p-4 space-y-4 ${SCREEN_PAD}`}>
        {header(p.invoiceNo || p.supplierName, () => setSel(null))}
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {p.supplierName}
          {p.invoiceDate ? ` · ${p.invoiceDate}` : ''}
        </p>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {t(lang, 'pur.total')}
            </span>
            <span className="block text-base font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {money(p.total)}
            </span>
          </div>
          <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {t(lang, 'pur.paid')}
            </span>
            <span className="block text-base font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {money(p.paid)}
            </span>
          </div>
          <div
            className={`rounded-xl p-3 ${
              bal > 0
                ? 'bg-amber-50 dark:bg-amber-950/40'
                : 'bg-slate-100 dark:bg-slate-800'
            }`}
          >
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {t(lang, 'pur.balance')}
            </span>
            <span
              className={`block text-base font-bold tabular-nums ${
                bal > 0
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-slate-900 dark:text-slate-50'
              }`}
            >
              {money(bal)}
            </span>
          </div>
        </div>

        {gst.enabled && p.gstInput > 0 && (
          <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800 dark:bg-teal-950/30 dark:text-teal-300">
            {t(lang, 'pur.itcNote').replace('{amt}', money(p.gstInput))}
          </p>
        )}

        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {t(lang, 'pur.lines')}
          </h3>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {p.lines.map((l, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="min-w-0 text-slate-700 dark:text-slate-200">
                  {l.name}
                  <span className="block text-xs text-slate-400 dark:text-slate-500">
                    {l.qty} {unitLabel(lang, l.unit)} × {money(l.costPrice)}
                    {gst.enabled && l.gstRate > 0 ? ` · GST ${l.gstRate}%` : ''}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums font-semibold text-slate-900 dark:text-slate-50">
                  {money(purchaseLineValue(l))}
                </span>
              </li>
            ))}
          </ul>
          {p.note && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {p.note}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={async () => {
            if (window.confirm(t(lang, 'pur.deleteConfirm'))) {
              await softDeletePurchase(p.id);
              setSel(null);
            }
          }}
          className="text-sm font-medium text-red-600 dark:text-red-400"
        >
          {t(lang, 'product.delete')}
        </button>
      </div>
    );
  }

  // ---- list ----
  return (
    <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
          {t(lang, 'pur.title')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="font-medium text-teal-700 dark:text-teal-300"
        >
          {t(lang, 'settings.close')}
        </button>
      </div>

      <div className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm dark:bg-slate-800">
        <div className="flex items-baseline justify-between">
          <span className="text-slate-500 dark:text-slate-400">
            {t(lang, 'pur.thisMonth')}
          </span>
          <span className="font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {money(summary.total)}
          </span>
        </div>
        {gst.enabled && summary.gstInput > 0 && (
          <p className="mt-0.5 text-xs text-teal-700 dark:text-teal-300">
            {t(lang, 'pur.itcMonth').replace('{amt}', money(summary.gstInput))}
          </p>
        )}
        {summary.unpaid > 0 && (
          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
            {t(lang, 'pur.unpaidMonth').replace('{amt}', money(summary.unpaid))}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          resetForm();
          setMode('form');
        }}
        className="h-11 w-full rounded-xl bg-teal-700 font-semibold text-white"
      >
        {t(lang, 'pur.new')}
      </button>

      {rows.length === 0 ? (
        <p className="pt-4 text-center text-slate-500 dark:text-slate-400">
          {t(lang, 'pur.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((p) => {
            const bal = purchaseBalance(p);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSel(p.id)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900 dark:text-slate-50">
                      {p.supplierName}
                    </span>
                    <span className="block text-xs text-slate-400 dark:text-slate-500">
                      {p.invoiceNo ? `${p.invoiceNo} · ` : ''}
                      {p.invoiceDate || ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                      {money(p.total)}
                    </span>
                    {bal > 0 && (
                      <span className="block text-xs font-medium text-amber-600 dark:text-amber-400">
                        {t(lang, 'pur.balance')} {money(bal)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
