'use client';

import { useMemo, useState } from 'react';
import { t, unitLabel, type Lang } from '../i18n';
import {
  createSupplier,
  paymentsFor,
  recordPayment,
  softDeleteSupplier,
  supplierLedger,
  updateSupplier,
} from '../db/suppliers';
import {
  applyMovement,
  listLowStock,
  NegativeStockError,
  searchProducts,
} from '../db/products';
import type { Product, SupplierPayment } from '../types';
import { useDebounced, useLiveQuery } from '../hooks';
import { SCREEN_PAD } from '../ui';

interface Props {
  lang: Lang;
  onClose: () => void;
  onScanPayment: () => void;
}

const field =
  'w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-slate-900 dark:text-slate-50';

const money = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function SuppliersScreen({
  lang,
  onClose,
  onScanPayment,
}: Props) {
  const ledger = useLiveQuery(() => supplierLedger(), [], []);
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<
    'list' | 'add' | 'pay' | 'edit' | 'return'
  >('list');

  // add / edit form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  // payment form
  const [amount, setAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  // return-goods form
  const [retTerm, setRetTerm] = useState('');
  const retDebounced = useDebounced(retTerm, 200);
  const [retProduct, setRetProduct] = useState<Product | null>(null);
  const [retQty, setRetQty] = useState('');
  const retResults = useLiveQuery(
    () => (retTerm.trim() ? searchProducts(retDebounced) : Promise.resolve([])),
    [retDebounced],
    [] as Product[],
  );

  const current = useMemo(
    () => ledger.find((r) => r.supplier.id === sel) ?? null,
    [ledger, sel],
  );
  const payments = useLiveQuery(
    () => (sel ? paymentsFor(sel) : Promise.resolve([])),
    [sel],
    [] as SupplierPayment[],
  );

  const resetForm = () => {
    setName('');
    setPhone('');
    setNote('');
    setAmount('');
    setPayNote('');
    setRetTerm('');
    setRetProduct(null);
    setRetQty('');
  };

  const submitReturn = async (allowNegative = false) => {
    if (!current || !retProduct) return;
    const qty = Number(retQty);
    if (!Number.isFinite(qty) || qty <= 0) return;
    const unitCost = retProduct.costPrice || retProduct.price || 0;
    try {
      await applyMovement({
        productId: retProduct.id,
        reason: 'return',
        delta: -Math.abs(qty),
        supplierId: current.supplier.id,
        note: 'return',
        allowNegative,
        ...(unitCost > 0 ? { unitCost } : {}),
      });
      resetForm();
      setMode('list');
    } catch (e) {
      if (e instanceof NegativeStockError && !allowNegative) {
        if (
          window.confirm(
            t(lang, 'sup.returnNegative').replace('{n}', String(e.available)),
          )
        ) {
          await submitReturn(true);
        }
        return;
      }
      throw e;
    }
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

  // ---- add / edit supplier ----
  if (mode === 'add' || mode === 'edit') {
    const submit = async () => {
      if (!name.trim()) return;
      if (mode === 'add') {
        await createSupplier({ name, phone, note });
      } else if (sel) {
        await updateSupplier(sel, { name, phone, note });
      }
      resetForm();
      setMode('list');
    };
    return (
      <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
        {header(
          t(lang, mode === 'add' ? 'sup.add' : 'sup.edit'),
          () => setMode(sel ? 'list' : 'list'),
        )}
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t(lang, 'sup.name')}
          className={field}
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder={t(lang, 'sup.phone')}
          className={field}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t(lang, 'adjust.note')}
          className={field}
        />
        <button
          type="button"
          onClick={submit}
          className="h-12 w-full rounded-xl bg-teal-700 font-bold text-white"
        >
          {t(lang, 'product.save')}
        </button>
      </div>
    );
  }

  // ---- record payment ----
  if (mode === 'pay' && current) {
    const submit = async () => {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) return;
      await recordPayment({ supplierId: current.supplier.id, amount: amt, note: payNote });
      resetForm();
      setMode('list');
    };
    return (
      <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
        {header(t(lang, 'sup.recordPayment'), () => setMode('list'))}
        <p className="text-slate-600 dark:text-slate-300">
          {current.supplier.name} · {t(lang, 'sup.owed')}{' '}
          <span className="font-semibold">{money(current.balance)}</span>
        </p>
        <input
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder={t(lang, 'sup.amount')}
          className={field}
        />
        <input
          value={payNote}
          onChange={(e) => setPayNote(e.target.value)}
          placeholder={t(lang, 'adjust.note')}
          className={field}
        />
        <button
          type="button"
          onClick={submit}
          className="h-12 w-full rounded-xl bg-teal-700 font-bold text-white"
        >
          {t(lang, 'product.save')}
        </button>
      </div>
    );
  }

  // ---- return goods to supplier ----
  if (mode === 'return' && current) {
    return (
      <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
        {header(t(lang, 'sup.return'), () => setMode('list'))}
        <p className="text-slate-600 dark:text-slate-300">
          {current.supplier.name} · {t(lang, 'sup.owed')}{' '}
          <span className="font-semibold">{money(current.balance)}</span>
        </p>

        {retProduct ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
              <span className="font-medium text-slate-900 dark:text-slate-50">
                {retProduct.name}
              </span>
              <button
                type="button"
                onClick={() => {
                  setRetProduct(null);
                  setRetQty('');
                }}
                className="text-sm font-medium text-teal-700 dark:text-teal-300"
              >
                {t(lang, 'adjust.pick')}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {retProduct.stockQty} {unitLabel(lang, retProduct.unit)}{' '}
              {t(lang, 'list.inStock')}
            </p>
            <input
              autoFocus
              value={retQty}
              onChange={(e) => setRetQty(e.target.value)}
              inputMode="decimal"
              placeholder={t(lang, 'sup.returnQty')}
              className={field}
            />
            <button
              type="button"
              onClick={() => submitReturn()}
              disabled={!(Number(retQty) > 0)}
              className="h-12 w-full rounded-xl bg-teal-700 font-bold text-white disabled:opacity-40"
            >
              {t(lang, 'product.save')}
            </button>
          </div>
        ) : (
          <>
            <input
              autoFocus
              value={retTerm}
              onChange={(e) => setRetTerm(e.target.value)}
              placeholder={t(lang, 'sup.returnPick')}
              className={field}
            />
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {retResults.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setRetProduct(p);
                      setRetTerm('');
                    }}
                    className="flex w-full items-center justify-between py-3 text-left"
                  >
                    <span className="font-medium text-slate-900 dark:text-slate-50">
                      {p.name}
                    </span>
                    <span className="text-sm text-slate-400 tabular-nums">
                      {p.stockQty} {unitLabel(lang, p.unit)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  }

  // ---- supplier detail ----
  if (sel && current) {
    return (
      <div className={`p-4 space-y-4 ${SCREEN_PAD}`}>
        {header(current.supplier.name, () => setSel(null))}
        {current.supplier.phone && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {current.supplier.phone}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 text-center">
          <Tile label={t(lang, 'sup.purchased')} value={money(current.purchased)} />
          <Tile label={t(lang, 'sup.paid')} value={money(current.paid)} />
          <Tile
            label={t(lang, 'sup.owed')}
            value={money(current.balance)}
            highlight={current.balance > 0}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('pay')}
            className="h-11 flex-1 rounded-xl bg-teal-700 font-semibold text-white"
          >
            {t(lang, 'sup.recordPayment')}
          </button>
          <button
            type="button"
            onClick={() => {
              setName(current.supplier.name);
              setPhone(current.supplier.phone ?? '');
              setNote(current.supplier.note ?? '');
              setMode('edit');
            }}
            className="h-11 px-4 rounded-xl bg-slate-200 dark:bg-slate-700 font-semibold text-slate-700 dark:text-slate-100"
          >
            {t(lang, 'sup.edit')}
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            resetForm();
            setMode('return');
          }}
          className="h-11 w-full rounded-xl bg-slate-200 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
        >
          {t(lang, 'sup.return')}
        </button>

        {current.supplier.phone && (
          <button
            type="button"
            onClick={async () => {
              const low = await listLowStock();
              const lines = low
                .map((p) => `- ${p.name} (${p.stockQty} ${unitLabel(lang, p.unit)})`)
                .join('\n');
              const msg = `${t(lang, 'sup.reorderMsg')}\n${lines || '—'}`;
              const phone = current.supplier.phone!.replace(/\D/g, '');
              const num = phone.length === 10 ? '91' + phone : phone;
              window.open(
                `https://wa.me/${num}?text=${encodeURIComponent(msg)}`,
                '_blank',
              );
            }}
            className="h-11 w-full rounded-xl bg-emerald-600 font-semibold text-white"
          >
            {t(lang, 'sup.reorderWhatsApp')}
          </button>
        )}

        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {t(lang, 'sup.payments')}
          </h3>
          {payments.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">—</p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {payments.map((p) => (
                <li key={p.id} className="flex justify-between py-2 text-sm">
                  <span className="text-slate-600 dark:text-slate-300">
                    {new Date(p.paidAt).toLocaleDateString('en-IN')}
                    {p.note ? ` · ${p.note}` : ''}
                  </span>
                  <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                    {money(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={async () => {
            if (confirm(t(lang, 'sup.deleteConfirm'))) {
              await softDeleteSupplier(current.supplier.id);
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
          {t(lang, 'sup.title')}
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
          onClick={() => {
            resetForm();
            setMode('add');
          }}
          className="h-11 rounded-xl bg-teal-700 font-semibold text-white"
        >
          {t(lang, 'sup.add')}
        </button>
        <button
          type="button"
          onClick={onScanPayment}
          className="h-11 rounded-xl bg-slate-200 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
        >
          {t(lang, 'doc.scanPayment')}
        </button>
      </div>

      {ledger.length === 0 ? (
        <p className="pt-4 text-center text-slate-500 dark:text-slate-400">
          {t(lang, 'sup.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {ledger.map((r) => (
            <li key={r.supplier.id}>
              <button
                type="button"
                onClick={() => setSel(r.supplier.id)}
                className="flex w-full items-center justify-between py-3 text-left"
              >
                <span className="font-medium text-slate-900 dark:text-slate-50">
                  {r.supplier.name}
                </span>
                {r.balance > 0 ? (
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    {t(lang, 'sup.owed')} {money(r.balance)}
                  </span>
                ) : (
                  <span className="text-sm text-slate-400 dark:text-slate-500">
                    {t(lang, 'sup.settled')}
                  </span>
                )}
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
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-2 ${
        highlight
          ? 'bg-amber-50 dark:bg-amber-950/40'
          : 'bg-slate-100 dark:bg-slate-800'
      }`}
    >
      <span className="block text-xs text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span
        className={`block font-bold tabular-nums ${
          highlight
            ? 'text-amber-800 dark:text-amber-300'
            : 'text-slate-900 dark:text-slate-50'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
