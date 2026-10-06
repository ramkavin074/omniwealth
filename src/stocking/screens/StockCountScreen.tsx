'use client';

import { useEffect, useMemo, useState } from 'react';
import { t, unitLabel, type Lang } from '../i18n';
import { applyMovement, findByBarcode, getProduct, searchProducts } from '../db/products';
import { useBackHandler, useDebounced, useLiveQuery } from '../hooks';
import { scanBarcode } from '../scanner/barcode';
import { askConfirm } from '../dialogs';
import { summariseCount } from '@/lib/stockCount';
import type { Product } from '../types';

const DRAFT_KEY = 'stocking.countDraft';
const MAX_ROWS = 60;

const money = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

const field =
  'h-11 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-slate-900 dark:text-slate-50';

type Draft = Record<string, string>; // productId -> counted quantity as typed

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : {};
  } catch {
    return {};
  }
}

export default function StockCountScreen({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  useBackHandler(true, () => {
    onClose();
    return true;
  });
  const [term, setTerm] = useState('');
  const debounced = useDebounced(term, 200);
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft]);

  const results = useLiveQuery(() => searchProducts(debounced), [debounced], [] as Product[]);

  // The products counted so far (kept in view above the search results).
  const countedIds = Object.keys(draft).filter((id) => draft[id].trim() !== '');
  const idsKey = countedIds.join(',');
  const counted = useLiveQuery(
    async () => {
      const got = await Promise.all((idsKey ? idsKey.split(',') : []).map((id) => getProduct(id)));
      return got.filter((p): p is Product => !!p && p.deletedAt === null);
    },
    [idsKey],
    [] as Product[],
  );

  const summary = useMemo(
    () =>
      summariseCount(
        counted.map((p) => ({
          id: p.id,
          name: p.name,
          system: p.stockQty,
          counted: draft[p.id]?.trim() === '' || draft[p.id] === undefined ? null : Number(draft[p.id]),
          unitCost: p.costPrice || p.price || 0,
        })),
      ),
    [counted, draft],
  );

  const flash = (s: string) => {
    setMsg(s);
    setTimeout(() => setMsg(null), 2500);
  };

  const setCount = (id: string, v: string) => setDraft((d) => ({ ...d, [id]: v }));

  const scan = async () => {
    const r = await scanBarcode(t(lang, 'scan.manualPrompt'));
    if (!r.ok) return;
    const p = await findByBarcode(r.barcode);
    if (!p) {
      flash(t(lang, 'sell.notInCatalogue'));
      return;
    }
    setTerm(p.name);
    setDraft((d) => (d[p.id] === undefined ? { ...d, [p.id]: '' } : d));
  };

  const apply = async () => {
    if (summary.countedItems === 0) return;
    const ok = await askConfirm(
      t(lang, 'cnt.confirm')
        .replace('{n}', String(summary.changed.length))
        .replace('{short}', money(summary.shortageValue))
        .replace('{over}', money(summary.excessValue)),
    );
    if (!ok) return;
    setBusy(true);
    try {
      for (const line of summary.changed) {
        await applyMovement({
          productId: line.id,
          reason: 'count',
          setTo: line.counted,
          note: 'stock-take',
          allowNegative: true,
        });
      }
      setDraft({});
      setTerm('');
      flash(t(lang, 'cnt.done').replace('{n}', String(summary.changed.length)));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (await askConfirm(t(lang, 'cnt.clearConfirm'))) setDraft({});
  };

  const row = (p: Product) => {
    const v = draft[p.id] ?? '';
    const n = v.trim() === '' ? null : Number(v);
    const diff = n === null || !Number.isFinite(n) ? null : Math.round((n - p.stockQty) * 1000) / 1000;
    return (
      <li key={p.id} className="flex items-center gap-2 py-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-slate-900 dark:text-slate-50">{p.name}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t(lang, 'cnt.system')}: {p.stockQty} {unitLabel(lang, p.unit)}
            {diff !== null && diff !== 0 && (
              <span className={diff < 0 ? 'ml-2 text-rose-600 dark:text-rose-400' : 'ml-2 text-amber-600 dark:text-amber-400'}>
                {diff > 0 ? '+' : ''}
                {diff}
              </span>
            )}
            {diff === 0 && <span className="ml-2 text-emerald-600 dark:text-emerald-400">✓</span>}
          </span>
        </span>
        <input
          inputMode="decimal"
          value={v}
          onChange={(e) => setCount(p.id, e.target.value)}
          placeholder={t(lang, 'cnt.counted')}
          className={`${field} w-24 text-right`}
        />
      </li>
    );
  };

  // Rows stay where they are while you type (a row that jumped between lists would
  // lose keyboard focus after every digit): search matches first, then anything
  // already counted that the current search does not show.
  const matches = results.slice(0, MAX_ROWS);
  const matchIds = new Set(matches.map((p) => p.id));
  const countedElsewhere = counted.filter((p) => !matchIds.has(p.id));

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-slate-950">
      <div className="flex items-center justify-between px-4 pt-[calc(0.75rem+var(--app-safe-top,0px))] pb-2">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{t(lang, 'cnt.title')}</h2>
        <button type="button" onClick={onClose} className="font-medium text-teal-700 dark:text-teal-300">
          {t(lang, 'settings.close')}
        </button>
      </div>
      <p className="px-4 text-xs text-slate-500 dark:text-slate-400">{t(lang, 'cnt.help')}</p>

      <div className="flex gap-2 px-4 py-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t(lang, 'cnt.search')}
          className={`${field} flex-1`}
        />
        <button
          type="button"
          onClick={scan}
          className="h-11 rounded-lg bg-slate-200 px-4 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
        >
          {t(lang, 'cnt.scan')}
        </button>
      </div>

      {msg && (
        <p className="mx-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {msg}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {matches.length > 0 && (
          <>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {t(lang, 'cnt.products')}
            </p>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">{matches.map(row)}</ul>
          </>
        )}
        {countedElsewhere.length > 0 && (
          <>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {t(lang, 'cnt.counting')} ({counted.length})
            </p>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">{countedElsewhere.map(row)}</ul>
          </>
        )}
        {matches.length === 0 && countedElsewhere.length === 0 && (
          <p className="pt-8 text-center text-slate-400 dark:text-slate-500">{t(lang, 'cnt.empty')}</p>
        )}
      </div>

      <div
        className="space-y-2 border-t border-slate-200 p-4 dark:border-slate-800"
        style={{ paddingBottom: 'calc(1rem + var(--app-safe-bottom))' }}
      >
        {summary.countedItems > 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t(lang, 'cnt.summary')
              .replace('{n}', String(summary.countedItems))
              .replace('{ok}', String(summary.matched))}
            {summary.shortageValue > 0 && (
              <span className="ml-2 font-semibold text-rose-600 dark:text-rose-400">
                {t(lang, 'cnt.short')} {money(summary.shortageValue)}
              </span>
            )}
            {summary.excessValue > 0 && (
              <span className="ml-2 font-semibold text-amber-600 dark:text-amber-400">
                {t(lang, 'cnt.over')} {money(summary.excessValue)}
              </span>
            )}
          </p>
        )}
        <div className="flex gap-2">
          {summary.countedItems > 0 && (
            <button
              type="button"
              onClick={clear}
              className="h-12 rounded-xl bg-slate-200 px-4 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
            >
              {t(lang, 'cnt.clear')}
            </button>
          )}
          <button
            type="button"
            onClick={apply}
            disabled={busy || summary.countedItems === 0}
            className="h-12 flex-1 rounded-xl bg-teal-700 font-bold text-white disabled:opacity-40"
          >
            {t(lang, 'cnt.apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
