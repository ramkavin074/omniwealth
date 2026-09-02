'use client';

import { useRef, useState } from 'react';
import { t, unitLabel, type Lang } from '../i18n';
import { UNITS, type Unit } from '../types';
import { receiveStock, type ReceiveLine } from '../db/products';
import {
  createSupplier,
  listSuppliers,
  recordPayment,
} from '../db/suppliers';
import { parseInvoice, parsePayment, type InvoiceLine } from '../parseDoc';
import { useLiveQuery } from '../hooks';
import { SCREEN_PAD } from '../ui';

interface Props {
  lang: Lang;
  kind: 'invoice' | 'payment';
  onClose: () => void;
}

const field =
  'h-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 text-slate-900 dark:text-slate-50';

type State =
  | { s: 'idle' }
  | { s: 'reading' }
  | { s: 'error'; msg: string }
  | { s: 'invoice'; lines: InvoiceLine[] }
  | { s: 'payment'; name: string; amount: string; date?: string }
  | { s: 'done'; msg: string };

export default function ScanDocScreen({ lang, kind, onClose }: Props) {
  const [state, setState] = useState<State>({ s: 'idle' });
  const [supplierId, setSupplierId] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const suppliers = useLiveQuery(() => listSuppliers(), [], []);

  const onFile = async (file: File) => {
    setState({ s: 'reading' });
    try {
      if (kind === 'invoice') {
        const lines = (await parseInvoice(file)).filter((l) => l.name);
        if (lines.length === 0) {
          setState({ s: 'error', msg: t(lang, 'doc.nothing') });
          return;
        }
        setState({ s: 'invoice', lines });
      } else {
        const p = await parsePayment(file);
        const match = suppliers.find((x) =>
          x.name.toLowerCase().includes(p.supplierName.toLowerCase()),
        );
        if (match) setSupplierId(match.id);
        setState({
          s: 'payment',
          name: p.supplierName,
          amount: p.amount ? String(p.amount) : '',
          date: p.date,
        });
      }
    } catch (e) {
      setState({ s: 'error', msg: (e as Error).message });
    }
  };

  const setLine = (i: number, patch: Partial<InvoiceLine>) =>
    setState((st) =>
      st.s === 'invoice'
        ? {
            ...st,
            lines: st.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)),
          }
        : st,
    );

  const commitInvoice = async () => {
    if (state.s !== 'invoice') return;
    let sup = supplierId;
    if (supplierId === '__new') {
      const n = window.prompt(t(lang, 'sup.name'))?.trim();
      if (!n) return;
      sup = (await createSupplier({ name: n })).id;
    }
    const rows: ReceiveLine[] = state.lines.map((l) => ({
      name: l.name,
      barcode: l.barcode,
      qty: Number(l.qty) || 0,
      unit: l.unit || 'piece',
      rate: Number(l.rate) || 0,
    }));
    const r = await receiveStock(rows, sup && sup !== '__new' ? sup : null);
    setState({
      s: 'done',
      msg: t(lang, 'doc.received')
        .replace('{n}', String(r.received))
        .replace('{c}', String(r.created)),
    });
  };

  const commitPayment = async () => {
    if (state.s !== 'payment') return;
    let sup = supplierId;
    if (!sup || sup === '__new') {
      const n = (sup === '__new' ? window.prompt(t(lang, 'sup.name')) : state.name)?.trim();
      if (!n) return;
      sup = (await createSupplier({ name: n })).id;
    }
    const amt = Number(state.amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    await recordPayment({
      supplierId: sup,
      amount: amt,
      note: 'from slip',
      paidAt: state.date ? Date.parse(state.date) || Date.now() : Date.now(),
    });
    setState({ s: 'done', msg: t(lang, 'sup.recordPayment') });
  };

  return (
    <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
          {t(lang, kind === 'invoice' ? 'doc.invoiceTitle' : 'doc.paymentTitle')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="font-medium text-teal-700 dark:text-teal-300"
        >
          {t(lang, 'settings.close')}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />

      {(state.s === 'idle' || state.s === 'error') && (
        <>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t(lang, 'doc.help')}
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="h-14 w-full rounded-xl bg-teal-700 text-lg font-bold text-white"
          >
            {t(lang, 'doc.take')}
          </button>
          {state.s === 'error' && (
            <p className="rounded-xl bg-red-100 px-4 py-3 text-red-700 dark:bg-red-900/40 dark:text-red-300">
              {state.msg}
            </p>
          )}
        </>
      )}

      {state.s === 'reading' && (
        <p className="pt-6 text-center text-slate-500 dark:text-slate-400">
          {t(lang, 'doc.reading')}
        </p>
      )}

      {state.s === 'invoice' && (
        <div className="space-y-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t(lang, 'doc.review')}
          </p>
          {state.lines.map((l, i) => (
            <div key={i} className="space-y-1 border-b border-slate-200 pb-2 dark:border-slate-800">
              <input
                value={l.name}
                onChange={(e) => setLine(i, { name: e.target.value })}
                className={`${field} w-full`}
              />
              <div className="grid grid-cols-3 gap-1">
                <input
                  inputMode="decimal"
                  value={String(l.qty)}
                  onChange={(e) => setLine(i, { qty: Number(e.target.value) })}
                  className={field}
                  aria-label="qty"
                />
                <input
                  inputMode="decimal"
                  value={String(l.rate)}
                  onChange={(e) => setLine(i, { rate: Number(e.target.value) })}
                  className={field}
                  aria-label="rate"
                />
                <select
                  value={l.unit}
                  onChange={(e) => setLine(i, { unit: e.target.value })}
                  className={field}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {unitLabel(lang, u as Unit)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}

          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className={`${field} w-full`}
          >
            <option value="">{t(lang, 'sup.pick')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="__new">＋ {t(lang, 'sup.add')}</option>
          </select>

          <button
            type="button"
            onClick={commitInvoice}
            className="h-12 w-full rounded-xl bg-teal-700 font-bold text-white"
          >
            {t(lang, 'doc.addToStock').replace(
              '{n}',
              String(state.lines.length),
            )}
          </button>
        </div>
      )}

      {state.s === 'payment' && (
        <div className="space-y-2">
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className={`${field} w-full`}
          >
            <option value="">
              {state.name || t(lang, 'sup.pick')}
            </option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="__new">＋ {t(lang, 'sup.add')}</option>
          </select>
          <input
            inputMode="decimal"
            value={state.amount}
            onChange={(e) =>
              setState({ ...state, amount: e.target.value })
            }
            placeholder={t(lang, 'sup.amount')}
            className={`${field} w-full`}
          />
          {state.date && (
            <p className="text-xs text-slate-400">{state.date}</p>
          )}
          <button
            type="button"
            onClick={commitPayment}
            className="h-12 w-full rounded-xl bg-teal-700 font-bold text-white"
          >
            {t(lang, 'sup.recordPayment')}
          </button>
        </div>
      )}

      {state.s === 'done' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-emerald-100 px-4 py-3 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            {state.msg}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-full rounded-xl bg-slate-200 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
          >
            {t(lang, 'import.done')}
          </button>
        </div>
      )}
    </div>
  );
}
