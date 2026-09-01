'use client';

import { SCREEN_PAD_STYLE } from '../ui';

import { useState } from 'react';
import { reasonLabel, t, unitLabel, type Lang } from '../i18n';
import type { Product } from '../types';
import { applyMovement, findByBarcode, undoMovement } from '../db/products';
import { lookupBarcodeName } from '../lookup';
import { scanBarcode } from '../scanner/barcode';
import QtyStepper from '../components/QtyStepper';
import NewProductForm from './NewProductForm';

type View =
  | { kind: 'idle'; message?: string }
  | { kind: 'busy' }
  | { kind: 'found'; product: Product; qty: number; direction: 'in' | 'out' }
  | { kind: 'notFound'; barcode: string; suggestedName: string }
  | { kind: 'saved'; name: string; qty: number; movementId?: string };

interface Props {
  lang: Lang;
}

export default function ScanScreen({ lang }: Props) {
  const [view, setView] = useState<View>({ kind: 'idle' });

  const startScan = async () => {
    setView({ kind: 'busy' });
    const result = await scanBarcode(t(lang, 'scan.manualPrompt'));

    if (!result.ok) {
      if (result.reason === 'cancelled') {
        setView({ kind: 'idle' });
      } else if (result.reason === 'permission') {
        setView({ kind: 'idle', message: t(lang, 'scan.permissionDenied') });
      } else {
        setView({ kind: 'idle', message: t(lang, 'scan.manualEntry') });
      }
      return;
    }

    const product = await findByBarcode(result.barcode);
    if (product) {
      setView({ kind: 'found', product, qty: 1, direction: 'out' });
      return;
    }

    // Not in the catalogue — try an online name lookup while the shopkeeper
    // reaches for the packet. Never blocks: any failure → empty name.
    const hit = await lookupBarcodeName(result.barcode);
    setView({
      kind: 'notFound',
      barcode: result.barcode,
      suggestedName: hit?.name ?? '',
    });
  };

  const save = async () => {
    if (view.kind !== 'found') return;
    const delta = view.direction === 'in' ? view.qty : -view.qty;
    const { movementId } = await applyMovement({
      productId: view.product.id,
      reason: view.direction === 'in' ? 'scan-in' : 'scan-out',
      delta,
    });
    setView({
      kind: 'saved',
      name: view.product.name,
      qty: view.qty,
      movementId,
    });
  };

  if (view.kind === 'notFound') {
    return (
      <div className="p-4" style={SCREEN_PAD_STYLE}>
        <p className="mb-3 text-slate-600 dark:text-slate-300">
          {t(lang, 'scan.notFound')}
        </p>
        <NewProductForm
          lang={lang}
          barcode={view.barcode}
          defaultName={view.suggestedName}
          nameFromLookup={view.suggestedName !== ''}
          onSaved={(p) =>
            setView({ kind: 'saved', name: p.name, qty: p.stockQty })
          }
          onCancel={() => setView({ kind: 'idle' })}
        />
      </div>
    );
  }

  if (view.kind === 'found') {
    const { product, qty, direction } = view;
    return (
      <div className="p-4 space-y-5" style={SCREEN_PAD_STYLE}>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            {product.name}
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            ₹{product.price}
            {product.mrp > 0 && product.mrp !== product.price && (
              <span className="ml-1 text-slate-400 line-through">
                ₹{product.mrp}
              </span>
            )}{' '}
            · {product.stockQty} {unitLabel(lang, product.unit)}{' '}
            {t(lang, 'list.inStock')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(['out', 'in'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setView({ ...view, direction: d })}
              className={`h-12 rounded-xl font-semibold transition ${
                direction === d
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              {reasonLabel(lang, d === 'in' ? 'scan-in' : 'scan-out')}
            </button>
          ))}
        </div>

        <QtyStepper
          value={qty}
          onChange={(n) => setView({ ...view, qty: n })}
          suffix={unitLabel(lang, product.unit)}
        />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setView({ kind: 'idle' })}
            className="flex-1 h-14 rounded-xl bg-slate-200 dark:bg-slate-700 font-semibold text-slate-700 dark:text-slate-100"
          >
            {t(lang, 'product.cancel')}
          </button>
          <button
            type="button"
            onClick={save}
            className="flex-[2] h-14 rounded-xl bg-teal-700 text-lg font-bold text-white"
          >
            {t(lang, 'product.save')}
          </button>
        </div>
      </div>
    );
  }

  // idle / busy / saved
  return (
    <div className="p-4 flex flex-col items-center gap-4" style={SCREEN_PAD_STYLE}>
      {view.kind === 'saved' && (
        <div className="w-full flex items-center justify-between gap-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 px-4 py-3 text-emerald-800 dark:text-emerald-200">
          <span className="min-w-0 truncate">
            {t(lang, 'product.saved')}: {view.name}
          </span>
          {view.movementId && (
            <button
              type="button"
              onClick={async () => {
                await undoMovement(view.movementId!);
                setView({ kind: 'idle', message: t(lang, 'scan.undone') });
              }}
              className="shrink-0 font-semibold underline"
            >
              {t(lang, 'scan.undo')}
            </button>
          )}
        </div>
      )}
      {view.kind === 'idle' && view.message && (
        <div className="w-full rounded-xl bg-amber-100 dark:bg-amber-900/40 px-4 py-3 text-amber-800 dark:text-amber-200">
          {view.message}
        </div>
      )}

      <button
        type="button"
        onClick={startScan}
        disabled={view.kind === 'busy'}
        className="mt-8 w-full max-w-sm h-40 rounded-3xl bg-teal-700 text-2xl font-bold text-white shadow-lg active:scale-[0.98] transition disabled:opacity-50"
      >
        {view.kind === 'busy' ? '…' : t(lang, 'scan.cta')}
      </button>

      <button
        type="button"
        onClick={startScan}
        className="text-teal-700 dark:text-teal-300 font-medium underline"
      >
        {t(lang, 'scan.manualEntry')}
      </button>
    </div>
  );
}
