'use client';

import { useMemo, useState } from 'react';
import { t, type Lang } from '../i18n';
import {
  addReceipt,
  allReceivables,
  creditRisk,
  customerLedger,
  softDeleteCustomer,
  upsertCustomer,
  type CreditRisk,
} from '../db/customers';
import { getSale } from '../db/sales';
import type { ReceiptTender, Sale } from '../types';
import { useLiveQuery } from '../hooks';
import { canManage, getReceiptConfig } from '../settings';
import { upiPayLine } from '../upiLink';
import { SCREEN_PAD } from '../ui';

interface Props {
  lang: Lang;
  onClose: () => void;
  onOpenBill?: (sale: Sale) => void;
}

const field =
  'w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-slate-900 dark:text-slate-50';

const money = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function CustomersScreen({ lang, onClose, onOpenBill }: Props) {
  const recv = useLiveQuery(() => allReceivables(), [], {
    total: 0,
    overLimitCount: 0,
    rows: [],
  });
  const risk = useLiveQuery(
    () => creditRisk(),
    [],
    new Map<string, CreditRisk>(),
  );
  const canEdit = useMemo(() => canManage(), []);

  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'add' | 'edit' | 'receipt'>('list');

  // add / edit form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [place, setPlace] = useState('');
  const [gstin, setGstin] = useState('');
  const [limit, setLimit] = useState('');
  const [opening, setOpening] = useState('');
  const [note, setNote] = useState('');
  // receipt form
  const [amount, setAmount] = useState('');
  const [rTender, setRTender] = useState<ReceiptTender>('cash');
  const [rNote, setRNote] = useState('');

  const current = useMemo(
    () => recv.rows.find((r) => r.customer.id === sel) ?? null,
    [recv.rows, sel],
  );
  const ledger = useLiveQuery(
    () =>
      sel
        ? customerLedger(sel)
        : Promise.resolve({ opening: 0, entries: [], balance: 0 }),
    [sel],
    { opening: 0, entries: [], balance: 0 },
  );

  const resetForm = () => {
    setName('');
    setPhone('');
    setPlace('');
    setGstin('');
    setLimit('');
    setOpening('');
    setNote('');
    setAmount('');
    setRNote('');
    setRTender('cash');
  };

  const header = (title: string, back: () => void) => (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={back}
        className="font-medium text-teal-700 dark:text-teal-300"
      >
        ←
      </button>
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
        {title}
      </h2>
      <span className="w-6" />
    </div>
  );

  // ---- add / edit ----
  if (mode === 'add' || mode === 'edit') {
    const submit = async () => {
      if (!name.trim()) return;
      await upsertCustomer({
        id: mode === 'edit' && sel ? sel : undefined,
        name,
        phone,
        place,
        gstin,
        ...(canEdit
          ? {
              creditLimit: Number(limit) || 0,
              openingBalance: Number(opening) || 0,
            }
          : {}),
        note,
      });
      resetForm();
      setMode('list');
    };
    return (
      <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
        {header(
          t(lang, mode === 'add' ? 'cust.add' : 'cust.edit'),
          () => setMode('list'),
        )}
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t(lang, 'cust.name')}
          className={field}
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder={t(lang, 'cust.phone')}
          className={field}
        />
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder={t(lang, 'cust.place')}
          className={field}
        />
        <input
          value={gstin}
          onChange={(e) => setGstin(e.target.value)}
          placeholder={t(lang, 'cust.gstin')}
          className={field}
        />
        {canEdit && (
          <div className="grid grid-cols-2 gap-2">
            <input
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              inputMode="decimal"
              placeholder={t(lang, 'cust.limit')}
              className={field}
            />
            <input
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              inputMode="decimal"
              placeholder={t(lang, 'cust.opening')}
              className={field}
            />
          </div>
        )}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t(lang, 'adjust.note')}
          className={field}
        />
        <button
          type="button"
          onClick={submit}
          className="h-12 w-full rounded-xl bg-teal-700 font-bold text-white"
        >
          {t(lang, 'product.save')}
        </button>
      </div>
    );
  }

  // ---- record receipt ----
  if (mode === 'receipt' && current) {
    const submit = async () => {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) return;
      await addReceipt({
        customerId: current.customer.id,
        amount: amt,
        tender: rTender,
        note: rNote,
      });
      resetForm();
      setMode('list');
    };
    return (
      <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
        {header(t(lang, 'cust.receipt'), () => setMode('list'))}
        <p className="text-slate-600 dark:text-slate-300">
          {current.customer.name} · {t(lang, 'cust.balance')}{' '}
          <span className="font-semibold">{money(current.balance)}</span>
        </p>
        <input
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder={t(lang, 'cust.amount')}
          className={field}
        />
        <div className="grid grid-cols-2 gap-2">
          {(['cash', 'upi'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setRTender(k)}
              className={`h-11 rounded-xl font-semibold ${
                rTender === k
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
              }`}
            >
              {t(lang, `sell.tender.${k}`)}
            </button>
          ))}
        </div>
        <input
          value={rNote}
          onChange={(e) => setRNote(e.target.value)}
          placeholder={t(lang, 'adjust.note')}
          className={field}
        />
        <button
          type="button"
          onClick={submit}
          className="h-12 w-full rounded-xl bg-teal-700 font-bold text-white"
        >
          {t(lang, 'product.save')}
        </button>
      </div>
    );
  }

  // ---- detail ----
  if (sel && current) {
    const c = current.customer;
    const waReminder = () => {
      if (!c.phone) return;
      const digits = c.phone.replace(/\D/g, '');
      const num = digits.length === 10 ? '91' + digits : digits;
      const rc = getReceiptConfig();
      const msg =
        t(lang, 'cust.reminderMsg')
          .replace('{name}', c.name)
          .replace('{amt}', money(current.balance)) +
        upiPayLine(
          {
            pa: rc.upiId,
            pn: rc.shopName || undefined,
            am: current.balance,
            tn: `${c.name} khata`,
          },
          t(lang, 'upi.payBy'),
        );
      window.open(
        `https://wa.me/${num}?text=${encodeURIComponent(msg)}`,
        '_blank',
      );
    };
    return (
      <div className={`p-4 space-y-4 ${SCREEN_PAD}`}>
        {header(c.name, () => setSel(null))}
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {[c.phone, c.place].filter(Boolean).join(' · ') || '—'}
        </p>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div
            className={`rounded-xl p-3 ${
              current.balance > 0
                ? 'bg-rose-50 dark:bg-rose-950/40'
                : 'bg-slate-100 dark:bg-slate-800'
            }`}
          >
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {t(lang, 'cust.balance')}
            </span>
            <span
              className={`block text-xl font-bold tabular-nums ${
                current.balance > 0
                  ? 'text-rose-700 dark:text-rose-300'
                  : 'text-slate-900 dark:text-slate-50'
              }`}
            >
              {money(current.balance)}
            </span>
          </div>
          <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {t(lang, 'cust.limit')}
            </span>
            <span className="block text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {c.creditLimit > 0 ? money(c.creditLimit) : '—'}
            </span>
          </div>
        </div>

        {current.overLimit && (
          <p className="rounded-lg bg-rose-100 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            {t(lang, 'cust.overBy').replace(
              '{amt}',
              money(current.balance - c.creditLimit),
            )}
          </p>
        )}

        {risk.get(c.id)?.watch && (
          <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            {t(lang, 'cust.watchWhy').replace(
              '{amt}',
              money(risk.get(c.id)!.balNow - risk.get(c.id)!.bal60),
            )}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              resetForm();
              setMode('receipt');
            }}
            className="h-11 flex-1 rounded-xl bg-teal-700 font-semibold text-white"
          >
            {t(lang, 'cust.receipt')}
          </button>
          {c.phone && (
            <button
              type="button"
              onClick={waReminder}
              className="h-11 flex-1 rounded-xl bg-emerald-600 font-semibold text-white"
            >
              {t(lang, 'cust.remind')}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setName(c.name);
            setPhone(c.phone ?? '');
            setPlace(c.place ?? '');
            setGstin(c.gstin ?? '');
            setLimit(c.creditLimit ? String(c.creditLimit) : '');
            setOpening(c.openingBalance ? String(c.openingBalance) : '');
            setNote(c.note ?? '');
            setMode('edit');
          }}
          className="h-11 w-full rounded-xl bg-slate-200 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
        >
          {t(lang, 'cust.edit')}
        </button>

        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {t(lang, 'cust.ledger')}
          </h3>
          {ledger.entries.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">—</p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {[...ledger.entries].reverse().map((e, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <button
                    type="button"
                    disabled={e.kind !== 'bill' || !onOpenBill}
                    onClick={async () => {
                      if (e.kind === 'bill' && onOpenBill) {
                        const s = await getSale(e.saleId);
                        if (s) onOpenBill(s);
                      }
                    }}
                    className="min-w-0 text-left disabled:cursor-default"
                  >
                    <span className="block text-slate-700 dark:text-slate-200">
                      {e.kind === 'bill'
                        ? `${t(lang, 'cust.bill')} ${e.billNo}`
                        : `${t(lang, 'cust.receiptEntry')} · ${t(lang, `sell.tender.${e.tender}`)}`}
                    </span>
                    <span className="block text-xs text-slate-400 dark:text-slate-500">
                      {new Date(e.at).toLocaleDateString('en-IN')}
                    </span>
                  </button>
                  <span className="shrink-0 text-right tabular-nums">
                    <span
                      className={
                        e.amount >= 0
                          ? 'font-semibold text-rose-600 dark:text-rose-400'
                          : 'font-semibold text-emerald-600 dark:text-emerald-400'
                      }
                    >
                      {e.amount >= 0 ? '+' : ''}
                      {money(e.amount)}
                    </span>
                    <span className="block text-xs text-slate-400 dark:text-slate-500">
                      {money(e.running)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={async () => {
              if (
                current.balance !== 0 &&
                !window.confirm(t(lang, 'cust.deleteWithBalance'))
              )
                return;
              if (window.confirm(t(lang, 'cust.deleteConfirm'))) {
                await softDeleteCustomer(c.id);
                setSel(null);
              }
            }}
            className="text-sm font-medium text-red-600 dark:text-red-400"
          >
            {t(lang, 'product.delete')}
          </button>
        )}
      </div>
    );
  }

  // ---- list ----
  const needle = q.trim().toLowerCase();
  const rows = recv.rows.filter(
    (r) =>
      !needle ||
      `${r.customer.name} ${r.customer.phone ?? ''} ${r.customer.place ?? ''}`
        .toLowerCase()
        .includes(needle),
  );

  return (
    <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
          {t(lang, 'cust.title')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="font-medium text-teal-700 dark:text-teal-300"
        >
          {t(lang, 'settings.close')}
        </button>
      </div>

      {recv.total > 0 && (
        <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm dark:bg-rose-950/40">
          <span className="font-semibold text-rose-700 dark:text-rose-300">
            {t(lang, 'cust.receivables')
              .replace('{amt}', money(recv.total))
              .replace('{n}', String(rows.filter((r) => r.balance > 0).length))}
          </span>
          {recv.overLimitCount > 0 && (
            <span className="ml-1 text-rose-600 dark:text-rose-400">
              · {t(lang, 'cust.overLimitN').replace('{n}', String(recv.overLimitCount))}
            </span>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t(lang, 'cust.search')}
          className={`${field} flex-1`}
        />
        <button
          type="button"
          onClick={() => {
            resetForm();
            setMode('add');
          }}
          className="h-11 shrink-0 rounded-xl bg-teal-700 px-4 font-semibold text-white"
        >
          {t(lang, 'cust.add')}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="pt-4 text-center text-slate-500 dark:text-slate-400">
          {t(lang, 'cust.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((r) => (
            <li key={r.customer.id}>
              <button
                type="button"
                onClick={() => setSel(r.customer.id)}
                className="flex w-full items-center justify-between gap-3 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-900 dark:text-slate-50">
                    {r.customer.name}
                    {risk.get(r.customer.id)?.watch && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                        {t(lang, 'cust.watch')}
                      </span>
                    )}
                  </span>
                  {r.customer.phone && (
                    <span className="block text-xs text-slate-400 dark:text-slate-500">
                      {r.customer.phone}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right">
                  {r.balance > 0 ? (
                    <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                      {money(r.balance)}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400 dark:text-slate-500">
                      {r.balance < 0 ? money(r.balance) : t(lang, 'cust.settled')}
                    </span>
                  )}
                  {r.overLimit && (
                    <span className="block text-[11px] font-semibold uppercase text-rose-500">
                      {t(lang, 'cust.overLimit')}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
