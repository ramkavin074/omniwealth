'use client';

import { useState } from 'react';
import { t, unitLabel, type Lang } from '../i18n';
import { isLowStock, UNITS, type Product, type Unit } from '../types';
import {
  applyMovement,
  searchProducts,
  softDeleteProduct,
  updateProduct,
} from '../db/products';
import { useDebounced, useLiveQuery } from '../hooks';
import LowStockBadge from '../components/LowStockBadge';
import ImportScreen from './ImportScreen';

interface Props {
  lang: Lang;
}

export default function ProductListScreen({ lang }: Props) {
  const [term, setTerm] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const debounced = useDebounced(term, 200);

  const products = useLiveQuery(
    () => searchProducts(debounced),
    [debounced],
    [] as Product[],
  );

  const visible = lowOnly ? products.filter(isLowStock) : products;

  if (importing) {
    return <ImportScreen lang={lang} onClose={() => setImporting(false)} />;
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex gap-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t(lang, 'list.search')}
          className="flex-1 h-12 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-lg text-slate-900 dark:text-slate-50"
        />
        <button
          type="button"
          onClick={() => setImporting(true)}
          className="shrink-0 h-12 px-4 rounded-xl bg-slate-200 dark:bg-slate-700 font-semibold text-slate-700 dark:text-slate-100"
        >
          {t(lang, 'import.button')}
        </button>
      </div>

      <label className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          checked={lowOnly}
          onChange={(e) => setLowOnly(e.target.checked)}
          className="h-5 w-5 accent-amber-500"
        />
        {t(lang, 'list.lowOnly')}
      </label>

      {visible.length === 0 && (
        <p className="pt-6 text-center text-slate-500 dark:text-slate-400">
          {term || lowOnly ? t(lang, 'list.noMatch') : t(lang, 'list.empty')}
        </p>
      )}

      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {visible.map((p) =>
          editingId === p.id ? (
            <EditRow
              key={p.id}
              lang={lang}
              product={p}
              onDone={() => setEditingId(null)}
            />
          ) : (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setEditingId(p.id)}
                className="w-full py-3 flex items-center justify-between gap-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-slate-900 dark:text-slate-50 truncate">
                    {p.name}
                  </span>
                  <span className="block text-sm text-slate-500 dark:text-slate-400">
                    ₹{p.price}
                    {p.mrp > 0 && p.mrp !== p.price && (
                      <span className="ml-1 line-through">₹{p.mrp}</span>
                    )}{' '}
                    · {p.barcode || t(lang, 'product.noBarcode')}
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {isLowStock(p) && (
                    <LowStockBadge label={t(lang, 'list.lowBadge')} />
                  )}
                  <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-100">
                    {p.stockQty}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {unitLabel(lang, p.unit)}
                  </span>
                </span>
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

const field =
  'h-11 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 text-slate-900 dark:text-slate-50';

function EditRow({
  lang,
  product,
  onDone,
}: {
  lang: Lang;
  product: Product;
  onDone: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [mrp, setMrp] = useState(String(product.mrp));
  const [price, setPrice] = useState(String(product.price));
  const [unit, setUnit] = useState<Unit>(product.unit);
  const [threshold, setThreshold] = useState(String(product.lowStockThreshold));
  const [stock, setStock] = useState(String(product.stockQty));

  const save = async () => {
    await updateProduct(product.id, {
      name,
      mrp: Number(mrp) || 0,
      price: Number(price) || 0,
      unit,
      lowStockThreshold: Number(threshold) || 0,
    });
    const nextStock = Number(stock);
    if (Number.isFinite(nextStock) && nextStock !== product.stockQty) {
      await applyMovement({
        productId: product.id,
        reason: 'correction',
        setTo: nextStock,
      });
    }
    onDone();
  };

  const remove = async () => {
    if (confirm(t(lang, 'product.deleteConfirm'))) {
      await softDeleteProduct(product.id);
      onDone();
    }
  };

  return (
    <li className="py-3 space-y-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={`${field} w-full text-lg`}
      />
      <div className="grid grid-cols-3 gap-2">
        <input
          inputMode="decimal"
          value={mrp}
          onChange={(e) => setMrp(e.target.value)}
          className={field}
          aria-label={t(lang, 'product.mrp')}
          placeholder={t(lang, 'product.mrp')}
        />
        <input
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className={field}
          aria-label={t(lang, 'product.rate')}
          placeholder={t(lang, 'product.rate')}
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as Unit)}
          className={field}
          aria-label={t(lang, 'product.unit')}
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {unitLabel(lang, u)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          inputMode="decimal"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className={field}
          aria-label={t(lang, 'product.stock')}
          placeholder={t(lang, 'product.stock')}
        />
        <input
          inputMode="decimal"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className={field}
          aria-label={t(lang, 'product.lowStockThreshold')}
          placeholder={t(lang, 'product.lowStockThreshold')}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={remove}
          className="h-10 px-3 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-sm font-medium"
        >
          {t(lang, 'product.delete')}
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onDone}
          className="h-10 px-4 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-100 font-medium"
        >
          {t(lang, 'product.cancel')}
        </button>
        <button
          type="button"
          onClick={save}
          className="h-10 px-5 rounded-lg bg-teal-700 text-white font-semibold"
        >
          {t(lang, 'product.save')}
        </button>
      </div>
    </li>
  );
}
