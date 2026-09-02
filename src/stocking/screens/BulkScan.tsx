'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { t, unitLabel, type Lang } from '../i18n';
import type { Product } from '../types';
import { applyMovement, findByBarcode, getProduct } from '../db/products';
import { scanBarcode } from '../scanner/barcode';
import { SCREEN_PAD } from '../ui';
import Numpad from '../components/Numpad';
import NewProductForm from './NewProductForm';

type Mode = 'count' | 'in' | 'out';

interface Line {
  product: Product;
  n: number; // count so far (count mode) / units applied (in/out)
  systemQty: number; // stock when this line was first opened
}

interface Props {
  lang: Lang;
  onExit: () => void;
}

export default function BulkScan({ lang, onExit }: Props) {
  const [mode, setMode] = useState<Mode>('count');
  const [running, setRunning] = useState(false);
  // `countsRef` is the source of truth (mutated synchronously in the rapid
  // scan loop); `lines` is a render-only mirror. A Map keeps insertion order.
  const countsRef = useRef<Map<string, Line>>(new Map());
  const [lines, setLines] = useState<Map<string, Line>>(new Map());
  const [flash, setFlash] = useState<string | null>(null);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [editLine, setEditLine] = useState<Line | null>(null);
  const [result, setResult] = useState<string[] | null>(null);

  const runningRef = useRef(false);
  const modeRef = useRef<Mode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const mirror = useCallback(() => setLines(new Map(countsRef.current)), []);

  const record = useCallback(
    async (product: Product) => {
      const m = modeRef.current;
      const prev = countsRef.current.get(product.id);
      const newCount = (prev?.n ?? 0) + 1;
      countsRef.current.set(product.id, {
        product,
        n: newCount,
        systemQty: prev?.systemQty ?? product.stockQty,
      });
      mirror();
      if (m === 'in' || m === 'out') {
        await applyMovement({
          productId: product.id,
          reason: m === 'in' ? 'scan-in' : 'scan-out',
          delta: m === 'in' ? 1 : -1,
          note: 'bulk',
          // Rapid reconciliation loop — a per-scan confirm would break the
          // flow; the running tally is visible to the user.
          allowNegative: true,
        });
      }
      setFlash(
        t(lang, 'bulk.scanned')
          .replace('{name}', product.name)
          .replace('{n}', String(newCount)),
      );
    },
    [lang, mirror],
  );

  const loop = useCallback(async () => {
    while (runningRef.current) {
      const r = await scanBarcode(t(lang, 'scan.manualPrompt'));
      if (!r.ok) {
        runningRef.current = false;
        setRunning(false);
        return;
      }
      const product = await findByBarcode(r.barcode);
      if (product) {
        await record(product);
      } else {
        runningRef.current = false;
        setRunning(false);
        setPendingBarcode(r.barcode);
        return;
      }
    }
  }, [lang, record]);

  const start = () => {
    setResult(null);
    setFlash(null);
    runningRef.current = true;
    setRunning(true);
    loop();
  };
  const stop = () => {
    runningRef.current = false;
    setRunning(false);
  };

  const setLineN = (id: string, n: number) => {
    const cur = countsRef.current.get(id);
    if (cur) countsRef.current.set(id, { ...cur, n: Math.max(0, n) });
    mirror();
  };

  const removeLine = (id: string) => {
    countsRef.current.delete(id);
    mirror();
  };

  const applyCount = async () => {
    const diffs: string[] = [];
    for (const line of countsRef.current.values()) {
      const fresh = await getProduct(line.product.id);
      const from = fresh?.stockQty ?? line.systemQty;
      if (from === line.n) continue;
      await applyMovement({
        productId: line.product.id,
        reason: 'count',
        setTo: line.n,
        note: 'stock-take',
      });
      diffs.push(
        t(lang, 'bulk.diff')
          .replace('{name}', line.product.name)
          .replace('{from}', String(from))
          .replace('{to}', String(line.n)),
      );
    }
    setResult(diffs);
    countsRef.current = new Map();
    mirror();
  };

  const ordered = [...lines.values()];
  const total = ordered.reduce((s, l) => s + l.n, 0);

  if (pendingBarcode !== null) {
    return (
      <div className={`p-4 ${SCREEN_PAD}`}>
        <p className="mb-3 text-slate-600 dark:text-slate-300">
          {t(lang, 'scan.notFound')}
        </p>
        <NewProductForm
          lang={lang}
          barcode={pendingBarcode}
          onSaved={async (p) => {
            setPendingBarcode(null);
            await record(p);
            start();
          }}
          onCancel={() => setPendingBarcode(null)}
        />
      </div>
    );
  }

  return (
    <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
          {t(lang, 'bulk.title')}
        </h2>
        <button
          type="button"
          onClick={() => {
            stop();
            onExit();
          }}
          className="font-medium text-teal-700 dark:text-teal-300"
        >
          {t(lang, 'bulk.exit')}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {(['count', 'in', 'out'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            disabled={running || ordered.length > 0}
            onClick={() => setMode(m)}
            className={`h-9 rounded-lg text-sm font-semibold transition disabled:opacity-40 ${
              mode === m
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {t(lang, `bulk.mode.${m}`)}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={running ? stop : start}
        className={`h-20 w-full rounded-2xl text-xl font-bold text-white ${
          running ? 'bg-rose-600' : 'bg-teal-700'
        }`}
      >
        {running ? t(lang, 'bulk.stop') : t(lang, 'bulk.start')}
      </button>

      {flash && (
        <div className="rounded-xl bg-emerald-100 px-4 py-2 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
          {flash}
        </div>
      )}

      {result && (
        <div className="space-y-1 rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
          <p className="font-semibold text-slate-800 dark:text-slate-100">
            {t(lang, 'bulk.applied')} · {result.length}
          </p>
          {result.map((d) => (
            <p key={d} className="text-sm text-slate-600 dark:text-slate-300">
              {d}
            </p>
          ))}
        </div>
      )}

      {ordered.length === 0 && !result && (
        <p className="pt-4 text-center text-slate-500 dark:text-slate-400">
          {t(lang, 'bulk.nothing')}
        </p>
      )}

      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {ordered.map((l) => (
          <li key={l.product.id} className="flex items-center gap-2 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-slate-900 dark:text-slate-50">
                {l.product.name}
              </span>
              {mode === 'count' && (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {t(lang, 'bulk.systemQty').replace('{n}', String(l.systemQty))}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setEditLine(l)}
              className="tabular-nums text-lg font-bold text-slate-800 dark:text-slate-100"
            >
              {mode === 'out' ? '−' : ''}
              {l.n} {unitLabel(lang, l.product.unit)}
            </button>
            <button
              type="button"
              onClick={() => removeLine(l.product.id)}
              className="px-1 text-xl text-slate-400 dark:text-slate-500"
              aria-label="remove"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {mode === 'count' && ordered.length > 0 && (
        <button
          type="button"
          onClick={applyCount}
          className="h-14 w-full rounded-xl bg-teal-700 text-lg font-bold text-white"
        >
          {t(lang, 'bulk.applyCount').replace('{n}', String(ordered.length))}
        </button>
      )}
      {(mode === 'in' || mode === 'out') && ordered.length > 0 && (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          {t(lang, 'bulk.committed').replace('{n}', String(total))}
        </p>
      )}

      {editLine && (
        <Numpad
          initial={editLine.n}
          title={editLine.product.name}
          unit={unitLabel(lang, editLine.product.unit)}
          okLabel={t(lang, 'numpad.ok')}
          cancelLabel={t(lang, 'product.cancel')}
          onSubmit={(n) => {
            setLineN(editLine.product.id, n);
            setEditLine(null);
          }}
          onCancel={() => setEditLine(null)}
        />
      )}
    </div>
  );
}
