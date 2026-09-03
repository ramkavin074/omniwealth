'use client';

import { useRef, useState } from 'react';
import { t, unitLabel, type Lang } from '../i18n';
import { GST_RATES, UNITS, type Unit } from '../types';
import {
  createSupplier,
  listSuppliers,
  recordPayment,
} from '../db/suppliers';
import { recordPurchase } from '../db/purchases';
import { getGstConfig } from '../settings';
import { parseInvoice, parsePayment, type InvoiceLine } from '../parseDoc';
import { useLiveQuery } from '../hooks';
import { SCREEN_PAD } from '../ui';

const isoToday = () => new Date().toISOString().slice(0, 10);

interface Props {
  lang: Lang;
  kind: 'invoice' | 'payment';
  onClose: () => void;
}

const field =
  'h-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 text-slate-900 dark:text-slate-50';

interface InvLine extends InvoiceLine {
  gstRate: number;
}

type State =
  | { s: 'idle' }
  | { s: 'reading' }
  | { s: 'error'; msg: string }
  | { s: 'invoice'; lines: InvLine[] }
  | { s: 'payment'; name: string; amount: string; date?: string }
  | { s: 'done'; msg: string };

export default function ScanDocScreen({ lang, kind, onClose }: Props) {
  const gst = getGstConfig();
  const [state, setState] = useState<State>({ s: 'idle' });
  const [supplierId, setSupplierId] = useState('');
  const [invNo, setInvNo] = useState('');
  const [invDate, setInvDate] = useState(isoToday());
  const [paid, setPaid] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const suppliers = useLiveQuery(() => listSuppliers(), [], []);

  const onFile = async (file: File) => {
    setState({ s: 'reading' });
    try {
      if (kind === 'invoice') {
        const parsed = (await parseInvoice(file)).filter((l) => l.name);
        if (parsed.length === 0) {
          setState({ s: 'error', msg: t(lang, 'doc.nothing') });
          return;
        }
        const dflt = gst.enabled ? gst.defaultRate : 0;
        setState({
          s: 'invoice',
          lines: parsed.map((l) => ({ ...l, gstRate: dflt })),
        });
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

  const setLine = (i: number, patch: Partial<InvLine>) =>
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
    let supName = suppliers.find((x) => x.id === supplierId)?.name ?? '';
    if (!sup || sup === '__new') {
      const n = window.prompt(t(lang, 'sup.name'))?.trim();
      if (!n) return;
      const created = await createSupplier({ name: n });
      sup = created.id;
      supName = created.name;
    }
    const lines = state.lines
      .filter((l) => l.name.trim() && (Number(l.qty) || 0) > 0)
      .map((l) => ({
        name: l.name,
        barcode: l.barcode ?? null,
        qty: Number(l.qty) || 0,
        unit: l.unit || 'piece',
        costPrice: Number(l.rate) || 0,
        gstRate: gst.enabled ? Number(l.gstRate) || 0 : 0,
      }));
    if (lines.length === 0) return;
    const p = await recordPurchase({
      invoiceNo: invNo.trim() || undefined,
      supplierId: sup,
      supplierName: supName,
      invoiceDate: invDate || undefined,
      paid: Number(paid) || 0,
      note: 'scanned bill',
      lines,
    });
    setState({
      s: 'done',
      msg: t(lang, 'doc.purchased')
        .replace('{n}', String(p.lines.length))
        .replace('{amt}', '₹' + Math.round(p.total).toLocaleString('en-IN')),
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
          <div className="grid grid-cols-2 gap-1">
            <input
              value={invNo}
              onChange={(e) => setInvNo(e.target.value)}
              placeholder={t(lang, 'pur.invoiceNo')}
              className={field}
            />
            <input
              type="date"
              value={invDate}
              max={isoToday()}
              onChange={(e) => setInvDate(e.target.value)}
              className={field}
            />
          </div>

          {state.lines.map((l, i) => (
            <div key={i} className="space-y-1 border-b border-slate-200 pb-2 dark:border-slate-800">
              <input
                value={l.name}
                onChange={(e) => setLine(i, { name: e.target.value })}
                className={`${field} w-full`}
              />
              <div className={`grid gap-1 ${gst.enabled ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <input
                  inputMode="decimal"
                  value={String(l.qty)}
                  onChange={(e) => setLine(i, { qty: Number(e.target.value) })}
                  className={field}
                  aria-label="qty"
                  placeholder={t(lang, 'pur.qty')}
                />
                <input
                  inputMode="decimal"
                  value={String(l.rate)}
                  onChange={(e) => setLine(i, { rate: Number(e.target.value) })}
                  className={field}
                  aria-label="rate"
                  placeholder={t(lang, 'pur.cost')}
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
                {gst.enabled && (
                  <select
                    value={String(l.gstRate)}
                    onChange={(e) =>
                      setLine(i, { gstRate: Number(e.target.value) })
                    }
                    className={field}
                    aria-label="gst"
                  >
                    {GST_RATES.map((r) => (
                      <option key={r} value={r}>
                        {r}%
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600 dark:text-slate-300">
              {t(lang, 'pur.paid')}
            </label>
            <input
              inputMode="decimal"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              placeholder="0"
              className={`${field} flex-1`}
            />
          </div>

          <button
            type="button"
            onClick={commitInvoice}
            className="h-12 w-full rounded-xl bg-teal-700 font-bold text-white"
          >
            {t(lang, 'doc.bookPurchase').replace(
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
