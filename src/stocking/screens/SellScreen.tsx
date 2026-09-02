'use client';

import { useMemo, useState } from 'react';
import { t, unitLabel, type Lang } from '../i18n';
import { saleLineTotal, type Sale, type TenderType, type Unit } from '../types';
import { findByBarcode, searchProducts } from '../db/products';
import { completeSale } from '../db/sales';
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

  const [tender, setTender] = useState<TenderType>('cash');
  const [cashGiven, setCashGiven] = useState('');
  const [upiPart, setUpiPart] = useState('');
  const [saved, setSaved] = useState<Sale | null>(null);

  const results = useLiveQuery(
    () => (term.trim() ? searchProducts(debounced) : Promise.resolve([])),
    [debounced],
    [],
  );

  const total = useMemo(
    () => Math.round(cart.reduce((s, l) => s + l.qty * l.unitPrice, 0) * 100) / 100,
    [cart],
  );

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
  const canComplete =
    cart.length > 0 &&
    (tender === 'upi' ||
      (tender === 'cash' && (cashGiven === '' || Number(cashGiven) >= total)) ||
      (tender === 'split' &&
        Number(upiPart) >= 0 &&
        Number(upiPart) <= total));

  const complete = async () => {
    if (!canComplete) return;
    setBusy(true);
    try {
      const sale = await completeSale({
        items: cart.map((l) => ({
          productId: l.productId,
          name: l.name,
          unit: l.unit,
          qty: l.qty,
          unitPrice: l.unitPrice,
        })),
        tenderType: tender,
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

  const reset = () => {
    setCart([]);
    setTerm('');
    setTender('cash');
    setCashGiven('');
    setUpiPart('');
    setSaved(null);
    setPhase('cart');
  };

  const receiptText = (s: Sale) =>
    [
      s.billNo,
      new Date(s.createdAt).toLocaleString('en-IN'),
      ...s.items.map(
        (i) =>
          `${i.name}  ${i.qty} ${unitLabel(lang, i.unit)} x ${i.unitPrice} = ${saleLineTotal(i)}`,
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
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-lg font-bold text-slate-900 dark:border-slate-700 dark:text-slate-50">
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
          <span className="block text-sm text-slate-500 dark:text-slate-400">
            {t(lang, 'sell.total')}
          </span>
          <span className="block text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {money(total)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(['cash', 'upi', 'split'] as const).map((k) => (
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
          <p className="pt-10 text-center text-slate-400 dark:text-slate-500">
            {t(lang, 'sell.empty')}
          </p>
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
          disabled={cart.length === 0}
          className="h-14 w-full rounded-xl bg-teal-700 text-lg font-bold text-white disabled:opacity-40"
        >
          {t(lang, 'sell.takePayment')}
        </button>
      </div>
    </div>
  );
}
