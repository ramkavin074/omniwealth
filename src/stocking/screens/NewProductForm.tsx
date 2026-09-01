'use client';

import { useState } from 'react';
import { t, unitLabel, type Lang } from '../i18n';
import { UNITS, type Product, type Unit } from '../types';
import { createProduct } from '../db/products';

interface Props {
  lang: Lang;
  barcode: string | null;
  /** Name pre-filled from the online barcode lookup, if any. */
  defaultName?: string;
  nameFromLookup?: boolean;
  onSaved: (product: Product) => void;
  onCancel: () => void;
}

const field =
  'w-full h-12 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-lg text-slate-900 dark:text-slate-50';
const label = 'block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1';

export default function NewProductForm({
  lang,
  barcode,
  defaultName = '',
  nameFromLookup = false,
  onSaved,
  onCancel,
}: Props) {
  const [name, setName] = useState(defaultName);
  const [mrp, setMrp] = useState('');
  const [price, setPrice] = useState('');
  const [openingStock, setOpeningStock] = useState('');
  const [unit, setUnit] = useState<Unit>('piece');
  const [threshold, setThreshold] = useState('5');
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0 && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const product = await createProduct({
        barcode,
        name,
        mrp: Number(mrp) || 0,
        price: Number(price) || 0,
        openingStock: Number(openingStock) || 0,
        unit,
        lowStockThreshold: Number(threshold) || 0,
      });
      onSaved(product);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <span className={label}>{t(lang, 'product.barcode')}</span>
        <div className="h-12 flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 px-3 text-lg font-mono text-slate-700 dark:text-slate-200">
          {barcode || t(lang, 'product.noBarcode')}
        </div>
      </div>

      <div>
        <label className={label} htmlFor="np-name">
          {t(lang, 'product.name')}
        </label>
        <input
          id="np-name"
          autoFocus={!defaultName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={field}
        />
        {nameFromLookup && name === defaultName && (
          <p className="mt-1 text-xs text-teal-700 dark:text-teal-400">
            {t(lang, 'scan.nameFromCatalogue')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="np-mrp">
            {t(lang, 'product.mrp')}
          </label>
          <input
            id="np-mrp"
            inputMode="decimal"
            value={mrp}
            onChange={(e) => setMrp(e.target.value)}
            className={field}
          />
        </div>
        <div>
          <label className={label} htmlFor="np-price">
            {t(lang, 'product.rate')}
          </label>
          <input
            id="np-price"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={mrp || undefined}
            className={field}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="np-unit">
            {t(lang, 'product.unit')}
          </label>
          <select
            id="np-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value as Unit)}
            className={field}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {unitLabel(lang, u)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="np-open">
            {t(lang, 'product.openingStock')}
          </label>
          <input
            id="np-open"
            inputMode="decimal"
            value={openingStock}
            onChange={(e) => setOpeningStock(e.target.value)}
            className={field}
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="np-thresh">
          {t(lang, 'product.lowStockThreshold')}
        </label>
        <input
          id="np-thresh"
          inputMode="decimal"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className={field}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 font-semibold text-slate-700 dark:text-slate-100"
        >
          {t(lang, 'product.cancel')}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canSave}
          className="flex-[2] h-12 rounded-xl bg-teal-700 font-semibold text-white disabled:opacity-40"
        >
          {t(lang, 'product.save')}
        </button>
      </div>
    </div>
  );
}
