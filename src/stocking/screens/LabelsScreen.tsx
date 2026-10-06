'use client';

import { useState } from 'react';
import { t, type Lang } from '../i18n';
import { searchProducts, updateProduct, listProducts } from '../db/products';
import { useBackHandler, useDebounced, useLiveQuery } from '../hooks';
import { getReceiptConfig } from '../settings';
import { canEncode128 } from '@/lib/code128';
import {
  labelsHtml,
  newInternalCode,
  printHtml,
  type LabelItem,
  type LabelLayout,
  type LabelPrice,
} from '../labels';
import { labelsPdf, shareLabelsPdf } from '../labelPdf';
import type { Product } from '../types';

const field =
  'h-11 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-slate-900 dark:text-slate-50';

interface Picked {
  product: Product;
  copies: string;
}

export default function LabelsScreen({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  useBackHandler(true, () => {
    onClose();
    return true;
  });
  const [term, setTerm] = useState('');
  const debounced = useDebounced(term, 200);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [layout, setLayout] = useState<LabelLayout>('a4');
  const [price, setPrice] = useState<LabelPrice>('rate');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const results = useLiveQuery(
    () => (debounced.trim() ? searchProducts(debounced) : Promise.resolve([] as Product[])),
    [debounced],
    [] as Product[],
  );

  const add = (p: Product) => {
    setPicked((cur) => (cur.some((x) => x.product.id === p.id) ? cur : [...cur, { product: p, copies: '1' }]));
    setTerm('');
  };
  const setCopies = (id: string, v: string) =>
    setPicked((cur) => cur.map((x) => (x.product.id === id ? { ...x, copies: v } : x)));
  const remove = (id: string) => setPicked((cur) => cur.filter((x) => x.product.id !== id));

  const flash = (s: string) => {
    setMsg(s);
    setTimeout(() => setMsg(null), 3500);
  };

  const print = async () => {
    if (picked.length === 0) return;
    setBusy(true);
    try {
      // Items with no barcode get a short internal code (saved on the product) so the
      // sticker can be scanned at billing.
      const taken = new Set(
        (await listProducts()).map((p) => p.barcode).filter((b): b is string => !!b),
      );
      const items: LabelItem[] = [];
      let assigned = 0;
      let skipped = 0;
      for (const { product, copies } of picked) {
        let code = product.barcode?.trim() || '';
        if (!code) {
          code = newInternalCode(taken);
          taken.add(code);
          await updateProduct(product.id, { barcode: code });
          assigned++;
        } else if (!canEncode128(code)) {
          skipped++;
          continue;
        }
        items.push({
          name: product.name,
          barcode: code,
          rate: product.price,
          mrp: product.mrp,
          copies: Math.max(1, Math.floor(Number(copies)) || 1),
        });
      }
      if (items.length === 0) {
        flash(t(lang, 'lbl.nothing'));
        return;
      }
      const opts = { layout, price, shopName: getReceiptConfig().shopName || undefined };
      // On the phone there is no print dialog inside the app, so share a PDF (Print, Save,
      // a printer app). In a browser, open the print dialog directly.
      const shared = await shareLabelsPdf(await labelsPdf(items, opts), t(lang, 'lbl.title'));
      if (shared === 'unsupported') printHtml(labelsHtml(items, opts));
      else if (shared === 'error') flash(t(lang, 'lbl.failed'));
      const parts: string[] = [];
      if (assigned) parts.push(t(lang, 'lbl.assigned').replace('{n}', String(assigned)));
      if (skipped) parts.push(t(lang, 'lbl.skipped').replace('{n}', String(skipped)));
      if (parts.length) flash(parts.join(' '));
    } finally {
      setBusy(false);
    }
  };

  const seg = <T extends string>(value: T, set: (v: T) => void, options: [T, string][]) => (
    <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => set(v)}
          className={`h-9 flex-1 rounded-lg text-sm font-semibold transition ${
            value === v
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-slate-950">
      <div className="flex items-center justify-between px-4 pt-[calc(0.75rem+var(--app-safe-top,0px))] pb-2">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{t(lang, 'lbl.title')}</h2>
        <button type="button" onClick={onClose} className="font-medium text-teal-700 dark:text-teal-300">
          {t(lang, 'settings.close')}
        </button>
      </div>

      <div className="space-y-2 px-4 pb-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t(lang, 'lbl.search')}
          className={`${field} w-full`}
        />
        {results.length > 0 && (
          <ul className="max-h-48 divide-y divide-slate-200 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
            {results.slice(0, 12).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => add(p)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                >
                  <span className="text-slate-900 dark:text-slate-50">{p.name}</span>
                  <span className="text-slate-400">₹{p.price}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {picked.length === 0 ? (
          <p className="pt-8 text-center text-slate-400 dark:text-slate-500">{t(lang, 'lbl.empty')}</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {picked.map(({ product: p, copies }) => (
              <li key={p.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900 dark:text-slate-50">{p.name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {p.barcode ? p.barcode : t(lang, 'lbl.newCode')}
                  </span>
                </span>
                <input
                  inputMode="numeric"
                  value={copies}
                  onChange={(e) => setCopies(p.id, e.target.value)}
                  aria-label={t(lang, 'lbl.copies')}
                  className={`${field} w-16 text-center`}
                />
                <button type="button" onClick={() => remove(p.id)} className="text-slate-400" aria-label="remove">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        className="space-y-2 border-t border-slate-200 p-4 dark:border-slate-800"
        style={{ paddingBottom: 'calc(1rem + var(--app-safe-bottom))' }}
      >
        {msg && (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {msg}
          </p>
        )}
        {seg(layout, setLayout, [
          ['a4', t(lang, 'lbl.a4')],
          ['roll', t(lang, 'lbl.roll')],
        ])}
        {seg(price, setPrice, [
          ['rate', t(lang, 'lbl.priceRate')],
          ['mrp', t(lang, 'lbl.priceMrp')],
          ['none', t(lang, 'lbl.priceNone')],
        ])}
        <button
          type="button"
          onClick={print}
          disabled={busy || picked.length === 0}
          className="h-12 w-full rounded-xl bg-teal-700 font-bold text-white disabled:opacity-40"
        >
          {t(lang, 'lbl.print')}
        </button>
      </div>
    </div>
  );
}
