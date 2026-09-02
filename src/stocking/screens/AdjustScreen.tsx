'use client';

import { SCREEN_PAD } from '../ui';

import { useMemo, useState } from 'react';
import { reasonLabel, t, unitLabel, type Lang } from '../i18n';
import { WRITE_OFF_REASONS, type MovementReason, type Product } from '../types';
import {
  applyMovement,
  getProduct,
  NegativeStockError,
  searchProducts,
  updateProduct,
} from '../db/products';
import { createSupplier, listSuppliers } from '../db/suppliers';
import { useDebounced, useLiveQuery } from '../hooks';
import { canSeeCost } from '../settings';
import QtyStepper from '../components/QtyStepper';

interface Props {
  lang: Lang;
}

const MANUAL_REASONS: MovementReason[] = [
  'manual',
  'correction',
  ...WRITE_OFF_REASONS,
];

export default function AdjustScreen({ lang }: Props) {
  const [term, setTerm] = useState('');
  const debounced = useDebounced(term, 200);
  const [selected, setSelected] = useState<Product | null>(null);
  const [mode, setMode] = useState<'delta' | 'setTo'>('delta');
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState<MovementReason>('manual');
  const [note, setNote] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [expiry, setExpiry] = useState('');
  const [flash, setFlash] = useState<string | null>(null);

  // A positive delta is a stock-in → offer to record the purchase cost +
  // supplier (owner/manager only).
  const [showCost] = useState(canSeeCost);
  const isStockIn = mode === 'delta' && amount > 0 && showCost;

  const results = useLiveQuery(
    () => searchProducts(debounced),
    [debounced],
    [] as Product[],
  );
  const suppliers = useLiveQuery(() => listSuppliers(), [], []);

  // Keep the selected product's stock figure fresh after an apply.
  const live = useLiveQuery(
    () => (selected ? getProduct(selected.id) : Promise.resolve(undefined)),
    [selected?.id],
  );
  const current = useMemo(() => live ?? selected, [live, selected]);

  const isWriteOff = WRITE_OFF_REASONS.includes(reason);

  const runApply = async (allowNegative: boolean) => {
    if (!current) return;
    let sup = supplierId;
    if (isStockIn && supplierId === '__new') {
      const name = window.prompt(t(lang, 'sup.name'))?.trim();
      if (!name) return;
      sup = (await createSupplier({ name })).id;
    }
    // A write-off is always a loss — the entered amount is the quantity lost.
    const change = isWriteOff
      ? { delta: -Math.abs(amount) }
      : mode === 'delta'
        ? { delta: amount }
        : { setTo: amount };
    try {
      const { qtyAfter } = await applyMovement({
        productId: current.id,
        reason,
        note,
        allowNegative,
        ...(isStockIn && Number(unitCost) > 0
          ? { unitCost: Number(unitCost) }
          : {}),
        ...(isStockIn && sup && sup !== '__new' ? { supplierId: sup } : {}),
        ...change,
      });
      if (isStockIn && expiry) {
        await updateProduct(current.id, { expiryDate: expiry });
      }
      setFlash(`${t(lang, 'adjust.applied')} · ${qtyAfter}`);
      setSupplierId('');
      setAmount(0);
      setNote('');
      setUnitCost('');
      setExpiry('');
      setTimeout(() => setFlash(null), 2000);
    } catch (e) {
      if (e instanceof NegativeStockError && !allowNegative) {
        if (
          window.confirm(
            t(lang, 'scan.negConfirm').replace('{n}', String(e.available)),
          )
        ) {
          await runApply(true);
        }
        return;
      }
      throw e;
    }
  };

  const apply = () => runApply(false);

  if (!selected) {
    return (
      <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
        <input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t(lang, 'adjust.search')}
          className="w-full h-12 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-lg text-slate-900 dark:text-slate-50"
        />
        {results.length === 0 && (
          <p className="text-slate-500 dark:text-slate-400 pt-4 text-center">
            {t(lang, 'adjust.empty')}
          </p>
        )}
        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(p);
                  setMode('delta');
                  setAmount(0);
                  setReason('manual');
                }}
                className="w-full py-3 flex justify-between items-center text-left"
              >
                <span className="font-medium text-slate-900 dark:text-slate-50">
                  {p.name}
                </span>
                <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                  {p.stockQty} {unitLabel(lang, p.unit)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className={`p-4 space-y-5 ${SCREEN_PAD}`}>
      <button
        type="button"
        onClick={() => setSelected(null)}
        className="text-teal-700 dark:text-teal-300 font-medium"
      >
        ← {t(lang, 'adjust.pick')}
      </button>

      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          {current?.name}
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          {current?.stockQty} {current && unitLabel(lang, current.unit)}{' '}
          {t(lang, 'list.inStock')}
        </p>
      </div>

      {!isWriteOff && (
        <div className="grid grid-cols-2 gap-2">
          {(['delta', 'setTo'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setAmount(m === 'setTo' ? (current?.stockQty ?? 0) : 0);
              }}
              className={`h-11 rounded-xl font-semibold text-sm transition ${
                mode === m
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              {t(lang, m === 'delta' ? 'adjust.change' : 'adjust.setTo')}
            </button>
          ))}
        </div>
      )}

      {isWriteOff && (
        <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
          {t(lang, 'adjust.lossQty')}
        </p>
      )}

      <QtyStepper
        lang={lang}
        value={amount}
        onChange={setAmount}
        min={mode === 'delta' && !isWriteOff ? -999999 : 0}
        suffix={current ? unitLabel(lang, current.unit) : undefined}
      />

      <div>
        <span className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
          {t(lang, 'adjust.reason')}
        </span>
        <div className="grid grid-cols-2 gap-2">
          {MANUAL_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setReason(r);
                if (WRITE_OFF_REASONS.includes(r)) {
                  setMode('delta');
                  setAmount(0);
                }
              }}
              className={`h-10 rounded-lg text-sm font-medium transition ${
                reason === r
                  ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              {reasonLabel(lang, r)}
            </button>
          ))}
        </div>
      </div>

      {isStockIn && (
        <>
          <input
            inputMode="decimal"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            placeholder={t(lang, 'adjust.unitCost')}
            className="w-full h-11 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-slate-900 dark:text-slate-50"
          />
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full h-11 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-slate-900 dark:text-slate-50"
          >
            <option value="">{t(lang, 'sup.pick')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="__new">＋ {t(lang, 'sup.add')}</option>
          </select>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              {t(lang, 'product.expiry')}
            </span>
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-slate-900 dark:text-slate-50"
            />
          </label>
        </>
      )}

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t(lang, 'adjust.note')}
        className="w-full h-11 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-slate-900 dark:text-slate-50"
      />

      {flash && (
        <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/40 px-4 py-3 text-emerald-800 dark:text-emerald-200">
          {flash}
        </div>
      )}

      <button
        type="button"
        onClick={apply}
        disabled={mode === 'delta' && amount === 0}
        className="w-full h-14 rounded-xl bg-teal-700 text-lg font-bold text-white disabled:opacity-40"
      >
        {t(lang, 'adjust.apply')}
      </button>
    </div>
  );
}
