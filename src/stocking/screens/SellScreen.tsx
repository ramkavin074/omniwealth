'use client';

import { useMemo, useState } from 'react';
import { t, unitLabel, type Lang } from '../i18n';
import {
  computeSaleTax,
  saleLineTotal,
  type Sale,
  type TenderType,
  type Unit,
} from '../types';
import { getGstConfig } from '../settings';
import { findByBarcode, searchProducts } from '../db/products';
import {
  completeSale,
  discardHeld,
  holdSale,
  listHeld,
  resumeHeld,
} from '../db/sales';
import { allReceivables, upsertCustomer } from '../db/customers';
import { scanBarcode } from '../scanner/barcode';
import { useDebounced, useLiveQuery } from '../hooks';
import { SCREEN_PAD } from '../ui';

interface Props {
  lang: Lang;
  onClose: () => void;
}

interface CartLine {
  productId: string;
  name: string;
  unit: Unit;
  qty: number;
  unitPrice: number;
  gstRate: number;
}

const money = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

const inputCls =
  'h-11 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-slate-900 dark:text-slate-50';

export default function SellScreen({ lang, onClose }: Props) {
  const [phase, setPhase] = useState<'cart' | 'pay' | 'done'>('cart');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [term, setTerm] = useState('');
  const debounced = useDebounced(term, 200);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [discount, setDiscount] = useState('');
  const [quickAmt, setQuickAmt] = useState(''); // non-empty → amount-only sale
  const [tender, setTender] = useState<TenderType>('cash');
  const [cashGiven, setCashGiven] = useState('');
  const [upiPart, setUpiPart] = useState('');
  const [custId, setCustId] = useState('');
  const [newCust, setNewCust] = useState(false);
  const [ncName, setNcName] = useState('');
  const [ncPhone, setNcPhone] = useState('');
  const [saved, setSaved] = useState<Sale | null>(null);

  const recv = useLiveQuery(() => allReceivables(), [], {
    total: 0,
    overLimitCount: 0,
    rows: [],
  });

  const results = useLiveQuery(
    () => (term.trim() ? searchProducts(debounced) : Promise.resolve([])),
    [debounced],
    [],
  );
  const held = useLiveQuery(() => listHeld(), [], []);

  const isQuick = quickAmt.trim() !== '';
  const subtotal = useMemo(
    () =>
      isQuick
        ? Math.max(0, Number(quickAmt) || 0)
        : Math.round(cart.reduce((s, l) => s + l.qty * l.unitPrice, 0) * 100) /
          100,
    [cart, isQuick, quickAmt],
  );
  const disc = Math.min(Math.max(0, Number(discount) || 0), subtotal);
  const [gst] = useState(getGstConfig);
  const tax = useMemo(
    () =>
      computeSaleTax(
        cart.map((l) => ({ lineTotal: l.qty * l.unitPrice, gstRate: l.gstRate })),
        disc,
        gst,
      ),
    [cart, disc, gst],
  );
  const total =
    Math.round((subtotal - disc + tax.addToTotal) * 100) / 100;

  const flash = (s: string) => {
    setMsg(s);
    setTimeout(() => setMsg(null), 1800);
  };

  const addProduct = (p: {
    id: string;
    name: string;
    unit: string;
    price: number;
    mrp: number;
    gstRate?: number;
  }) => {
    setCart((c) => {
      const i = c.findIndex((l) => l.productId === p.id);
      if (i >= 0) {
        const next = c.slice();
        next[i] = { ...next[i], qty: Math.round((next[i].qty + 1) * 1000) / 1000 };
        return next;
      }
      return [
        ...c,
        {
          productId: p.id,
          name: p.name,
          unit: p.unit as Unit,
          qty: 1,
          unitPrice: p.price || p.mrp || 0,
          gstRate: p.gstRate ?? 0,
        },
      ];
    });
    setTerm('');
  };

  const scan = async () => {
    setBusy(true);
    const r = await scanBarcode(t(lang, 'scan.manualPrompt'));
    setBusy(false);
    if (!r.ok) return;
    const p = await findByBarcode(r.barcode);
    if (!p) {
      flash(t(lang, 'sell.notInCatalogue'));
      return;
    }
    addProduct(p);
  };

  const setQty = (id: string, qty: number) =>
    setCart((c) =>
      c
        .map((l) => (l.productId === id ? { ...l, qty } : l))
        .filter((l) => l.qty > 0),
    );
  const setPrice = (id: string, unitPrice: number) =>
    setCart((c) =>
      c.map((l) => (l.productId === id ? { ...l, unitPrice } : l)),
    );
  const removeLine = (id: string) =>
    setCart((c) => c.filter((l) => l.productId !== id));

  const change =
    tender === 'cash' ? Math.round((Number(cashGiven) - total) * 100) / 100 : 0;
  const splitCash =
    tender === 'split'
      ? Math.round((total - (Number(upiPart) || 0)) * 100) / 100
      : 0;
  const hasContent = isQuick ? subtotal > 0 : cart.length > 0;
  const custRow = recv.rows.find((r) => r.customer.id === custId) ?? null;
  const canComplete =
    total > 0 &&
    (tender === 'upi' ||
      (tender === 'cash' && (cashGiven === '' || Number(cashGiven) >= total)) ||
      (tender === 'credit' && !!custId) ||
      (tender === 'split' &&
        Number(upiPart) >= 0 &&
        Number(upiPart) <= total));

  const complete = async () => {
    if (!canComplete) return;
    setBusy(true);
    try {
      let customerId = custId;
      if (tender === 'credit' && newCust && ncName.trim()) {
        const c = await upsertCustomer({ name: ncName, phone: ncPhone });
        customerId = c.id;
      }
      const sale = await completeSale({
        items: isQuick
          ? []
          : cart.map((l) => ({
              productId: l.productId,
              name: l.name,
              unit: l.unit,
              qty: l.qty,
              unitPrice: l.unitPrice,
              gstRate: l.gstRate,
            })),
        ...(isQuick ? { manualTotal: subtotal } : {}),
        discount: disc,
        tenderType: tender,
        ...(tender === 'credit' ? { customerId } : {}),
        ...(tender === 'split'
          ? { cashAmount: splitCash, upiAmount: Number(upiPart) || 0 }
          : {}),
      });
      setSaved(sale);
      setPhase('done');
    } catch {
      flash(t(lang, 'sell.failed'));
    } finally {
      setBusy(false);
    }
  };

  const hold = async () => {
    if (cart.length === 0) return;
    const label = window.prompt(t(lang, 'sell.holdLabel')) ?? '';
    await holdSale(
      cart.map((l) => ({
        productId: l.productId,
        name: l.name,
        unit: l.unit,
        qty: l.qty,
        unitPrice: l.unitPrice,
        gstRate: l.gstRate,
      })),
      Number(discount) || 0,
      label,
    );
    setCart([]);
    setDiscount('');
    flash(t(lang, 'sell.held'));
  };

  const resume = async (id: string) => {
    const h = await resumeHeld(id);
    if (!h) return;
    setQuickAmt('');
    setCart(
      h.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        unit: i.unit,
        qty: i.qty,
        unitPrice: i.unitPrice,
        gstRate: i.gstRate ?? 0,
      })),
    );
    setDiscount(h.discount ? String(h.discount) : '');
  };

  const reset = () => {
    setCart([]);
    setTerm('');
    setDiscount('');
    setQuickAmt('');
    setTender('cash');
    setCashGiven('');
    setUpiPart('');
    setCustId('');
    setNewCust(false);
    setNcName('');
    setNcPhone('');
    setSaved(null);
    setPhase('cart');
  };

  const receiptText = (s: Sale) =>
    [
      s.billNo,
      new Date(s.createdAt).toLocaleString('en-IN'),
      ...(gst.gstin ? [`GSTIN: ${gst.gstin}`] : []),
      ...s.items.map(
        (i) =>
          `${i.name}  ${i.qty} ${unitLabel(lang, i.unit)} x ${i.unitPrice} = ${saleLineTotal(i)}`,
      ),
      ...(s.discount > 0 ? [`${t(lang, 'sell.discount')}: -${s.discount}`] : []),
      ...s.taxBreakup.map(
        (r) =>
          `GST ${r.rate}%  CGST ${r.cgst} + SGST ${r.sgst}`,
      ),
      `${t(lang, 'sell.total')}: ${money(s.total)}`,
      `${t(lang, 'sell.paid')}: ${s.tenderType.toUpperCase()}`,
    ].join('\n');

  // ---------- DONE / receipt ----------
  if (phase === 'done' && saved) {
    return (
      <div className={`p-4 space-y-4 ${SCREEN_PAD}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
            {t(lang, 'sell.done')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="font-medium text-teal-700 dark:text-teal-300"
          >
            {t(lang, 'settings.close')}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          {gst.gstin && (
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t(lang, 'sell.taxInvoice')} · GSTIN {gst.gstin}
            </p>
          )}
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-lg font-bold text-slate-900 dark:text-slate-50">
              {saved.billNo}
            </span>
            <span className="text-xs text-slate-400">
              {new Date(saved.createdAt).toLocaleTimeString('en-IN')}
            </span>
          </div>
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {saved.items.map((i) => (
              <li key={i.productId} className="flex justify-between py-1.5 text-sm">
                <span className="text-slate-700 dark:text-slate-200">
                  {i.name}{' '}
                  <span className="text-slate-400">
                    {i.qty} × {money(i.unitPrice)}
                  </span>
                </span>
                <span className="tabular-nums text-slate-800 dark:text-slate-100">
                  {money(saleLineTotal(i))}
                </span>
              </li>
            ))}
          </ul>
          {saved.discount > 0 && (
            <div className="mt-2 space-y-0.5 border-t border-slate-200 pt-2 text-sm dark:border-slate-700">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>{t(lang, 'sell.subtotal')}</span>
                <span className="tabular-nums">
                  {money(saved.total + saved.discount)}
                </span>
              </div>
              <div className="flex justify-between text-rose-600 dark:text-rose-400">
                <span>{t(lang, 'sell.discount')}</span>
                <span className="tabular-nums">−{money(saved.discount)}</span>
              </div>
            </div>
          )}
          {saved.taxBreakup.length > 0 && (
            <div
              className={`mt-2 space-y-0.5 ${
                saved.discount > 0 ? '' : 'border-t border-slate-200 pt-2 dark:border-slate-700'
              } text-xs text-slate-500 dark:text-slate-400`}
            >
              {saved.taxBreakup.map((r) => (
                <div key={r.rate} className="flex justify-between">
                  <span>
                    GST {r.rate}% ({money(r.taxable)})
                  </span>
                  <span className="tabular-nums">
                    CGST {money(r.cgst)} · SGST {money(r.sgst)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between font-medium text-slate-600 dark:text-slate-300">
                <span>{t(lang, 'sell.taxTotal')}</span>
                <span className="tabular-nums">{money(saved.taxTotal)}</span>
              </div>
            </div>
          )}
          <div
            className={`mt-2 flex justify-between ${
              saved.discount > 0 || saved.taxBreakup.length > 0
                ? ''
                : 'border-t border-slate-200 pt-2 dark:border-slate-700'
            } text-lg font-bold text-slate-900 dark:text-slate-50`}
          >
            <span>{t(lang, 'sell.total')}</span>
            <span className="tabular-nums">{money(saved.total)}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t(lang, 'sell.paid')}: {t(lang, `sell.tender.${saved.tenderType}`)}
            {saved.tenderType === 'cash' &&
              Number(cashGiven) > saved.total &&
              ` · ${t(lang, 'sell.change')} ${money(
                Number(cashGiven) - saved.total,
              )}`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              window.open(
                `https://wa.me/?text=${encodeURIComponent(receiptText(saved))}`,
                '_blank',
              )
            }
            className="h-12 rounded-xl bg-emerald-600 font-semibold text-white"
          >
            {t(lang, 'sell.whatsapp')}
          </button>
          <button
            type="button"
            onClick={reset}
            className="h-12 rounded-xl bg-teal-700 font-bold text-white"
          >
            {t(lang, 'sell.new')}
          </button>
        </div>
      </div>
    );
  }

  // ---------- PAY ----------
  if (phase === 'pay') {
    return (
      <div className={`p-4 space-y-4 ${SCREEN_PAD}`}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPhase('cart')}
            className="font-medium text-teal-700 dark:text-teal-300"
          >
            ← {t(lang, 'sell.back')}
          </button>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
            {t(lang, 'sell.takePayment')}
          </h2>
          <span className="w-6" />
        </div>

        <div className="rounded-2xl bg-slate-100 p-4 text-center dark:bg-slate-800">
          {disc > 0 && (
            <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">
              {t(lang, 'sell.subtotal')} {money(subtotal)} ·{' '}
              <span className="text-rose-600 dark:text-rose-400">
                −{money(disc)}
              </span>
            </p>
          )}
          {gst.enabled && tax.taxTotal > 0 && (
            <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">
              {gst.inclusive
                ? t(lang, 'sell.taxIncl')
                : t(lang, 'sell.taxAdd')}{' '}
              {money(tax.taxTotal)}
            </p>
          )}
          <span className="block text-sm text-slate-500 dark:text-slate-400">
            {t(lang, 'sell.total')}
          </span>
          <span className="block text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {money(total)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 dark:text-slate-300">
            {t(lang, 'sell.discount')}
          </label>
          <input
            inputMode="decimal"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="0"
            className={`${inputCls} w-24 text-right`}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(['cash', 'upi', 'credit', 'split'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTender(k)}
              className={`h-11 rounded-xl font-semibold transition ${
                tender === k
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
              }`}
            >
              {t(lang, `sell.tender.${k}`)}
            </button>
          ))}
        </div>

        {tender === 'credit' && (
          <div className="space-y-2">
            {newCust ? (
              <>
                <input
                  autoFocus
                  value={ncName}
                  onChange={(e) => setNcName(e.target.value)}
                  placeholder={t(lang, 'cust.name')}
                  className={`${inputCls} w-full`}
                />
                <input
                  value={ncPhone}
                  onChange={(e) => setNcPhone(e.target.value)}
                  inputMode="tel"
                  placeholder={t(lang, 'cust.phone')}
                  className={`${inputCls} w-full`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setNewCust(false);
                    setNcName('');
                    setNcPhone('');
                  }}
                  className="text-sm font-medium text-teal-700 dark:text-teal-300"
                >
                  {t(lang, 'sell.pickExisting')}
                </button>
              </>
            ) : (
              <>
                <select
                  value={custId}
                  onChange={(e) => setCustId(e.target.value)}
                  className={`${inputCls} w-full`}
                >
                  <option value="">{t(lang, 'sell.pickCustomer')}</option>
                  {recv.rows.map((r) => (
                    <option key={r.customer.id} value={r.customer.id}>
                      {r.customer.name}
                      {r.balance > 0 ? ` — ${money(r.balance)}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setNewCust(true);
                    setCustId('');
                  }}
                  className="text-sm font-medium text-teal-700 dark:text-teal-300"
                >
                  {t(lang, 'sell.newCustomer')}
                </button>
              </>
            )}
            {custRow && (
              <p
                className={`text-sm ${
                  custRow.customer.creditLimit > 0 &&
                  custRow.balance + total > custRow.customer.creditLimit
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {t(lang, 'sell.balanceAfter').replace(
                  '{amt}',
                  money(custRow.balance + total),
                )}
                {custRow.customer.creditLimit > 0 &&
                  custRow.balance + total > custRow.customer.creditLimit &&
                  ` · ${t(lang, 'sell.overLimit')}`}
              </p>
            )}
          </div>
        )}

        {tender === 'cash' && (
          <div className="space-y-2">
            <label className="block text-sm text-slate-600 dark:text-slate-300">
              {t(lang, 'sell.cashGiven')}
            </label>
            <div className="flex gap-2">
              <input
                inputMode="decimal"
                value={cashGiven}
                onChange={(e) => setCashGiven(e.target.value)}
                placeholder={String(total)}
                className={`${inputCls} flex-1`}
              />
              <button
                type="button"
                onClick={() => setCashGiven(String(total))}
                className="shrink-0 rounded-lg bg-slate-200 px-3 text-sm font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-200"
              >
                {t(lang, 'sell.exact')}
              </button>
            </div>
            {cashGiven !== '' && Number(cashGiven) >= total && (
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                {t(lang, 'sell.change')}: {money(change)}
              </p>
            )}
            {cashGiven !== '' && Number(cashGiven) < total && (
              <p className="text-sm text-rose-600 dark:text-rose-400">
                {t(lang, 'sell.short')}
              </p>
            )}
          </div>
        )}

        {tender === 'split' && (
          <div className="space-y-2">
            <label className="block text-sm text-slate-600 dark:text-slate-300">
              {t(lang, 'sell.upiPart')}
            </label>
            <input
              inputMode="decimal"
              value={upiPart}
              onChange={(e) => setUpiPart(e.target.value)}
              className={`${inputCls} w-full`}
            />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {t(lang, 'sell.tender.cash')}: {money(splitCash)}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={complete}
          disabled={!canComplete || busy}
          className="h-14 w-full rounded-xl bg-teal-700 text-lg font-bold text-white disabled:opacity-40"
        >
          {t(lang, 'sell.complete')}
        </button>
        {msg && (
          <p className="text-center text-sm text-rose-600 dark:text-rose-400">
            {msg}
          </p>
        )}
      </div>
    );
  }

  // ---------- CART ----------
  return (
    <div className={`flex h-full flex-col ${SCREEN_PAD}`}>
      <div className="shrink-0 space-y-2 p-4 pb-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
            {t(lang, 'sell.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="font-medium text-teal-700 dark:text-teal-300"
          >
            {t(lang, 'settings.close')}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={scan}
            disabled={busy}
            className="h-12 rounded-xl bg-teal-700 font-semibold text-white disabled:opacity-50"
          >
            {busy ? '…' : t(lang, 'sell.scan')}
          </button>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t(lang, 'sell.search')}
            className={`${inputCls} w-full`}
          />
        </div>

        {(cart.length > 0 || held.length > 0) && (
          <div className="flex items-center gap-2 text-sm">
            {cart.length > 0 && (
              <button
                type="button"
                onClick={hold}
                className="rounded-lg bg-slate-200 px-3 py-1.5 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
              >
                {t(lang, 'sell.hold')}
              </button>
            )}
            {held.length > 0 && (
              <div className="flex flex-1 gap-1 overflow-x-auto">
                {held.map((h) => (
                  <span
                    key={h.id}
                    className="flex shrink-0 items-center rounded-full bg-amber-100 pl-3 font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                  >
                    <button type="button" onClick={() => resume(h.id)}>
                      {h.label} ({h.items.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => discardHeld(h.id)}
                      className="px-2 py-1 text-amber-500"
                      aria-label="discard"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {term.trim() && results.length > 0 && (
          <ul className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
            {results.slice(0, 12).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => addProduct(p)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <span className="text-slate-900 dark:text-slate-50">
                    {p.name}
                  </span>
                  <span className="text-slate-400">{money(p.price)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {msg && (
          <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {msg}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {cart.length === 0 ? (
          <div className="pt-8 text-center">
            <p className="text-slate-400 dark:text-slate-500">
              {t(lang, 'sell.empty')}
            </p>
            <div className="mx-auto mt-6 flex max-w-xs items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t(lang, 'sell.quickAmount')}
              </span>
              <span className="text-slate-400">₹</span>
              <input
                inputMode="decimal"
                value={quickAmt}
                onChange={(e) => setQuickAmt(e.target.value)}
                className={`${inputCls} w-28 text-right`}
              />
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {cart.map((l) => (
              <li key={l.productId} className="py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 font-medium text-slate-900 dark:text-slate-50">
                    {l.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(l.productId)}
                    className="shrink-0 text-slate-400"
                    aria-label="remove"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setQty(
                        l.productId,
                        Math.round((l.qty - 1) * 1000) / 1000,
                      )
                    }
                    className="h-9 w-9 rounded-lg bg-slate-200 text-lg font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                  >
                    −
                  </button>
                  <input
                    inputMode="decimal"
                    value={String(l.qty)}
                    onChange={(e) =>
                      setQty(l.productId, Math.max(0, Number(e.target.value) || 0))
                    }
                    className={`${inputCls} w-16 text-center`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setQty(l.productId, Math.round((l.qty + 1) * 1000) / 1000)
                    }
                    className="h-9 w-9 rounded-lg bg-slate-200 text-lg font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                  >
                    +
                  </button>
                  <span className="text-slate-400">
                    {unitLabel(lang, l.unit)} ×
                  </span>
                  <input
                    inputMode="decimal"
                    value={String(l.unitPrice)}
                    onChange={(e) =>
                      setPrice(l.productId, Math.max(0, Number(e.target.value) || 0))
                    }
                    className={`${inputCls} w-20 text-right`}
                  />
                  <span className="ml-auto shrink-0 font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                    {money(l.qty * l.unitPrice)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 p-4 dark:border-slate-800">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-slate-500 dark:text-slate-400">
            {t(lang, 'sell.total')}
          </span>
          <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {money(total)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setCashGiven('');
            setUpiPart('');
            setPhase('pay');
          }}
          disabled={!hasContent}
          className="h-14 w-full rounded-xl bg-teal-700 text-lg font-bold text-white disabled:opacity-40"
        >
          {t(lang, 'sell.takePayment')}
        </button>
      </div>
    </div>
  );
}
