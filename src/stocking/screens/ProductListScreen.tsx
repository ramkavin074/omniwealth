'use client';

import { useMemo, useState } from 'react';
import { reasonLabel, t, unitLabel, type Lang } from '../i18n';
import {
  isLowStock,
  UNITS,
  type Movement,
  type Product,
  type Unit,
} from '../types';
import {
  applyMovement,
  filterProducts,
  listProducts,
  movementsFor,
  sortProducts,
  softDeleteProduct,
  updateProduct,
  type ProductSort,
} from '../db/products';
import { buildCatalogueCsv, downloadCsv } from '../export';
import { useDebounced, useIsDesktop, useLiveQuery } from '../hooks';
import { SHEET_OVERLAY, SHEET_PANEL } from '../ui';
import LowStockBadge from '../components/LowStockBadge';
import VirtualList from '../components/VirtualList';
import ImportScreen from './ImportScreen';
import NewProductForm from './NewProductForm';

interface Props {
  lang: Lang;
  lowOnly: boolean;
  onLowOnlyChange: (v: boolean) => void;
}

const ROW_H = 76;
// Clears the fixed bottom nav + OS gesture bar under the last row.
const FOOTER_PAD = 88;
const SORTS: ProductSort[] = ['recent', 'name', 'low'];

export default function ProductListScreen({
  lang,
  lowOnly,
  onLowOnlyChange,
}: Props) {
  const [term, setTerm] = useState('');
  const [sort, setSort] = useState<ProductSort>('recent');
  const [editing, setEditing] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const debounced = useDebounced(term, 200);
  const isDesktop = useIsDesktop();
  const footerPad = isDesktop ? 24 : FOOTER_PAD;

  // One live snapshot of the whole catalogue; filter/sort happen in memory.
  const all = useLiveQuery(() => listProducts(), [], [] as Product[]);

  const visible = useMemo(() => {
    let rows = filterProducts(all, debounced);
    if (lowOnly) rows = rows.filter(isLowStock);
    return sortProducts(rows, sort);
  }, [all, debounced, lowOnly, sort]);

  const exportCsv = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`stock-${date}.csv`, buildCatalogueCsv(all));
  };

  if (importing) {
    return <ImportScreen lang={lang} onClose={() => setImporting(false)} />;
  }

  return (
    <div className="flex h-full flex-col md:mx-auto md:w-full md:max-w-3xl">
      <div className="shrink-0 space-y-2 p-4 pb-2">
        <div className="space-y-2 md:flex md:items-center md:gap-2 md:space-y-0">
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t(lang, 'list.search')}
            className="w-full h-12 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-lg text-slate-900 dark:text-slate-50 md:flex-1"
          />

          <div className="grid grid-cols-3 gap-2 md:flex md:shrink-0">
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="h-10 rounded-lg bg-teal-700 px-3 text-sm font-semibold text-white"
            >
              {t(lang, 'list.addProduct')}
            </button>
            <button
              type="button"
              onClick={() => setImporting(true)}
              className="h-10 rounded-lg bg-slate-200 px-3 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
            >
              {t(lang, 'import.button')}
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={all.length === 0}
              className="h-10 rounded-lg bg-slate-200 px-3 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:bg-slate-700 dark:text-slate-100"
            >
              {t(lang, 'export.button')}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          {SORTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              className={`flex-1 h-9 rounded-lg text-sm font-semibold transition ${
                sort === s
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t(lang, `sort.${s}`)}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={(e) => onLowOnlyChange(e.target.checked)}
              className="h-5 w-5 accent-amber-500"
            />
            {t(lang, 'list.lowOnly')}
          </label>
          <span className="text-sm text-slate-400 dark:text-slate-500 tabular-nums">
            {t(lang, 'list.count').replace('{n}', String(visible.length))}
          </span>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="px-4 pt-6 text-center text-slate-500 dark:text-slate-400">
          {term || lowOnly ? t(lang, 'list.noMatch') : t(lang, 'list.empty')}
        </p>
      ) : (
        <VirtualList
          className="flex-1 min-h-0 px-4"
          items={visible}
          rowHeight={ROW_H}
          footerPad={footerPad}
          getKey={(p) => p.id}
          renderRow={(p) => (
            <button
              type="button"
              onClick={() => setEditing(p)}
              className="w-full h-full flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 text-left"
            >
              <span className="min-w-0">
                <span className="block font-medium text-slate-900 dark:text-slate-50 truncate">
                  {p.name}
                </span>
                <span className="block text-sm text-slate-500 dark:text-slate-400 truncate">
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
          )}
        />
      )}

      {editing && (
        <EditSheet
          lang={lang}
          product={editing}
          onDone={() => setEditing(null)}
        />
      )}

      {adding && (
        <div className={SHEET_OVERLAY}>
          <div
            className={`${SHEET_PANEL} max-h-[90vh] overflow-y-auto`}
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700 md:hidden" />
            <NewProductForm
              lang={lang}
              barcode={null}
              onSaved={() => setAdding(false)}
              onCancel={() => setAdding(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const field =
  'h-11 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 text-slate-900 dark:text-slate-50';
const sheetLabel =
  'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';

function EditSheet({
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

  const history = useLiveQuery(
    () => movementsFor(product.id, 8),
    [product.id],
    [] as Movement[],
  );

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
    <div className={SHEET_OVERLAY}>
      <div
        className={`${SHEET_PANEL} space-y-3`}
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700 md:hidden" />

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${field} w-full text-lg`}
          aria-label={t(lang, 'product.name')}
        />

        <div className="grid grid-cols-3 gap-2">
          <label>
            <span className={sheetLabel}>{t(lang, 'product.mrp')}</span>
            <input
              inputMode="decimal"
              value={mrp}
              onChange={(e) => setMrp(e.target.value)}
              className={`${field} w-full`}
            />
          </label>
          <label>
            <span className={sheetLabel}>{t(lang, 'product.rate')}</span>
            <input
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={`${field} w-full`}
            />
          </label>
          <label>
            <span className={sheetLabel}>{t(lang, 'product.unit')}</span>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as Unit)}
              className={`${field} w-full`}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {unitLabel(lang, u)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className={sheetLabel}>{t(lang, 'product.stock')}</span>
            <input
              inputMode="decimal"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className={`${field} w-full`}
            />
          </label>
          <label>
            <span className={sheetLabel}>
              {t(lang, 'product.lowStockThreshold')}
            </span>
            <input
              inputMode="decimal"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className={`${field} w-full`}
            />
          </label>
        </div>

        {history.length > 0 && (
          <div className="pt-1">
            <span className={sheetLabel}>{t(lang, 'history.title')}</span>
            <ul className="max-h-28 overflow-y-auto text-sm">
              {history.map((m) => (
                <li
                  key={m.id}
                  className="flex justify-between py-0.5 text-slate-600 dark:text-slate-300"
                >
                  <span>{reasonLabel(lang, m.reason)}</span>
                  <span className="tabular-nums">
                    {m.delta >= 0 ? '+' : ''}
                    {m.delta} → {m.qtyAfter}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={remove}
            className="h-11 px-3 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-sm font-medium"
          >
            {t(lang, 'product.delete')}
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onDone}
            className="h-11 px-4 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-100 font-medium"
          >
            {t(lang, 'product.cancel')}
          </button>
          <button
            type="button"
            onClick={save}
            className="h-11 px-5 rounded-lg bg-teal-700 text-white font-semibold"
          >
            {t(lang, 'product.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
