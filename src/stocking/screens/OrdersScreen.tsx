'use client';

import { useMemo, useState } from 'react';
import { t, type Lang } from '../i18n';
import {
  addOrderPayment,
  deliverOrder,
  listOrders,
  setOrderStatus,
  softDeleteOrder,
  upsertOrder,
} from '../db/orders';
import { listCustomers, upsertCustomer } from '../db/customers';
import { getSale } from '../db/sales';
import {
  OPEN_ORDER_STATUSES,
  orderBalance,
  todayISO,
  type Order,
  type OrderLine,
  type OrderStatus,
  type ReceiptTender,
  type Sale,
} from '../types';
import { useLiveQuery } from '../hooks';
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

const blankLine = (): OrderLine => ({ description: '', qty: 1, rate: 0 });

export default function OrdersScreen({ lang, onClose, onOpenBill }: Props) {
  const orders = useLiveQuery(() => listOrders(), [], [] as Order[]);
  const customers = useLiveQuery(() => listCustomers(), [], []);

  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'form' | 'payment' | 'deliver'>(
    'list',
  );

  // form (new / edit)
  const [editId, setEditId] = useState<string | null>(null);
  const [custId, setCustId] = useState('');
  const [newCust, setNewCust] = useState(false);
  const [ncName, setNcName] = useState('');
  const [ncPhone, setNcPhone] = useState('');
  const [lines, setLines] = useState<OrderLine[]>([blankLine()]);
  const [dueDate, setDueDate] = useState('');
  const [fNote, setFNote] = useState('');
  const [advance, setAdvance] = useState('');
  const [advTender, setAdvTender] = useState<ReceiptTender>('cash');

  // payment form
  const [payAmt, setPayAmt] = useState('');
  const [payTender, setPayTender] = useState<ReceiptTender>('cash');

  // deliver
  const [delTender, setDelTender] = useState<ReceiptTender>('cash');

  const current = useMemo(
    () => orders.find((o) => o.id === sel) ?? null,
    [orders, sel],
  );

  const formTotal = useMemo(
    () =>
      Math.round(
        lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0) *
          100,
      ) / 100,
    [lines],
  );

  const resetForm = () => {
    setEditId(null);
    setCustId('');
    setNewCust(false);
    setNcName('');
    setNcPhone('');
    setLines([blankLine()]);
    setDueDate('');
    setFNote('');
    setAdvance('');
    setAdvTender('cash');
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

  // ---- new / edit form ----
  if (mode === 'form') {
    const cleanLines = lines.filter(
      (l) => l.description.trim() && Number(l.qty) > 0,
    );
    const canSave =
      cleanLines.length > 0 &&
      (editId ? true : newCust ? ncName.trim().length > 0 : !!custId);

    const submit = async () => {
      if (!canSave) return;
      let customerId = custId;
      let customerName =
        customers.find((c) => c.id === custId)?.name ?? '';
      if (!editId && newCust) {
        const c = await upsertCustomer({
          name: ncName,
          phone: ncPhone || undefined,
        });
        customerId = c.id;
        customerName = c.name;
      }
      if (editId) {
        await upsertOrder({
          id: editId,
          customerId,
          customerName,
          lines: cleanLines,
          dueDate: dueDate || null,
          note: fNote,
        });
      } else {
        await upsertOrder({
          customerId,
          customerName,
          lines: cleanLines,
          dueDate: dueDate || null,
          note: fNote,
          advance: Number(advance) || 0,
          advanceTender: advTender,
        });
      }
      resetForm();
      setMode('list');
    };

    return (
      <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
        {header(
          t(lang, editId ? 'order.edit' : 'order.new'),
          () => {
            resetForm();
            setMode('list');
          },
        )}

        {!editId && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {t(lang, 'order.customer')}
            </p>
            {!newCust ? (
              <>
                <select
                  value={custId}
                  onChange={(e) => setCustId(e.target.value)}
                  className={field}
                >
                  <option value="">{t(lang, 'order.pickCustomer')}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.phone ? ` · ${c.phone}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setNewCust(true);
                    setCustId('');
                  }}
                  className="text-sm font-medium text-teal-700 dark:text-teal-300"
                >
                  {t(lang, 'order.newCustomer')}
                </button>
              </>
            ) : (
              <>
                <input
                  autoFocus
                  value={ncName}
                  onChange={(e) => setNcName(e.target.value)}
                  placeholder={t(lang, 'cust.name')}
                  className={field}
                />
                <input
                  value={ncPhone}
                  onChange={(e) => setNcPhone(e.target.value)}
                  inputMode="tel"
                  placeholder={t(lang, 'cust.phone')}
                  className={field}
                />
                <button
                  type="button"
                  onClick={() => setNewCust(false)}
                  className="text-sm font-medium text-teal-700 dark:text-teal-300"
                >
                  {t(lang, 'order.pickCustomer')}
                </button>
              </>
            )}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t(lang, 'order.lines')}
          </p>
          {lines.map((l, i) => (
            <div key={i} className="space-y-1.5 rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
              <input
                value={l.description}
                onChange={(e) => {
                  const next = [...lines];
                  next[i] = { ...l, description: e.target.value };
                  setLines(next);
                }}
                placeholder={t(lang, 'order.lineDesc')}
                className={field}
              />
              <div className="flex items-center gap-2">
                <input
                  value={String(l.qty)}
                  onChange={(e) => {
                    const next = [...lines];
                    next[i] = { ...l, qty: Number(e.target.value) || 0 };
                    setLines(next);
                  }}
                  inputMode="decimal"
                  placeholder={t(lang, 'order.lineQty')}
                  className={`${field} flex-1`}
                />
                <span className="text-slate-400">×</span>
                <input
                  value={String(l.rate)}
                  onChange={(e) => {
                    const next = [...lines];
                    next[i] = { ...l, rate: Number(e.target.value) || 0 };
                    setLines(next);
                  }}
                  inputMode="decimal"
                  placeholder={t(lang, 'order.lineRate')}
                  className={`${field} flex-1`}
                />
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLines(lines.filter((_, j) => j !== i))}
                    className="shrink-0 px-2 text-lg text-rose-500"
                    aria-label="remove line"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLines([...lines, blankLine()])}
            className="text-sm font-medium text-teal-700 dark:text-teal-300"
          >
            {t(lang, 'order.addLine')}
          </button>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {t(lang, 'order.total')}
          </span>
          <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {money(formTotal)}
          </span>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
            {t(lang, 'order.dueDate')}
          </span>
          <input
            type="date"
            value={dueDate}
            min={todayISO()}
            onChange={(e) => setDueDate(e.target.value)}
            className={field}
          />
        </label>

        <input
          value={fNote}
          onChange={(e) => setFNote(e.target.value)}
          placeholder={t(lang, 'order.note')}
          className={field}
        />

        {!editId && (
          <div className="space-y-2 rounded-lg bg-teal-50 p-2 dark:bg-teal-950/30">
            <span className="block text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
              {t(lang, 'order.advance')}
            </span>
            <input
              value={advance}
              onChange={(e) => setAdvance(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className={field}
            />
            {Number(advance) > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {(['cash', 'upi'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setAdvTender(k)}
                    className={`h-10 rounded-lg font-semibold ${
                      advTender === k
                        ? 'bg-teal-700 text-white'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {t(lang, `sell.tender.${k}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!canSave}
          className="h-12 w-full rounded-xl bg-teal-700 font-bold text-white disabled:opacity-40"
        >
          {t(lang, 'product.save')}
        </button>
      </div>
    );
  }

  // ---- take payment ----
  if (mode === 'payment' && current) {
    const bal = Math.max(0, orderBalance(current));
    const submit = async () => {
      const amt = Number(payAmt);
      if (!Number.isFinite(amt) || amt <= 0) return;
      await addOrderPayment({
        orderId: current.id,
        amount: amt,
        tender: payTender,
      });
      setPayAmt('');
      setMode('list');
    };
    return (
      <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
        {header(t(lang, 'order.addPayment'), () => setMode('list'))}
        <p className="text-slate-600 dark:text-slate-300">
          {current.orderNo} · {current.customerName} · {t(lang, 'order.balance')}{' '}
          <span className="font-semibold">{money(bal)}</span>
        </p>
        <input
          autoFocus
          value={payAmt}
          onChange={(e) => setPayAmt(e.target.value)}
          inputMode="decimal"
          placeholder={t(lang, 'cust.amount')}
          className={field}
        />
        <div className="grid grid-cols-2 gap-2">
          {(['cash', 'upi'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setPayTender(k)}
              className={`h-11 rounded-xl font-semibold ${
                payTender === k
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
              }`}
            >
              {t(lang, `sell.tender.${k}`)}
            </button>
          ))}
        </div>
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

  // ---- deliver ----
  if (mode === 'deliver' && current) {
    const bal = Math.max(0, orderBalance(current));
    const submit = async () => {
      const sale = await deliverOrder(current.id, delTender);
      setMode('list');
      setSel(null);
      if (onOpenBill) onOpenBill(sale);
    };
    return (
      <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
        {header(t(lang, 'order.deliver'), () => setMode('list'))}
        <p className="text-slate-600 dark:text-slate-300">
          {current.orderNo} · {current.customerName}
        </p>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {t(lang, 'order.total')}
            </span>
            <span className="block text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {money(current.total)}
            </span>
          </div>
          <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {t(lang, 'order.balance')}
            </span>
            <span className="block text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {money(bal)}
            </span>
          </div>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t(lang, 'order.deliverTender')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(['cash', 'upi'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setDelTender(k)}
              className={`h-11 rounded-xl font-semibold ${
                delTender === k
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
              }`}
            >
              {t(lang, `sell.tender.${k}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={submit}
          className="h-12 w-full rounded-xl bg-teal-700 font-bold text-white"
        >
          {t(lang, 'order.deliver')}
        </button>
      </div>
    );
  }

  // ---- detail ----
  if (sel && current) {
    const o = current;
    const bal = orderBalance(o);
    const done = o.status === 'delivered' || o.status === 'cancelled';
    return (
      <div className={`p-4 space-y-4 ${SCREEN_PAD}`}>
        {header(o.orderNo, () => setSel(null))}
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {o.customerName}
          {o.dueDate ? ` · ${t(lang, 'order.due')} ${o.dueDate}` : ''}
        </p>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {t(lang, 'order.total')}
            </span>
            <span className="block text-base font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {money(o.total)}
            </span>
          </div>
          <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {t(lang, 'order.advance')}
            </span>
            <span className="block text-base font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {money(o.advancePaid)}
            </span>
          </div>
          <div
            className={`rounded-xl p-3 ${
              bal > 0
                ? 'bg-rose-50 dark:bg-rose-950/40'
                : 'bg-slate-100 dark:bg-slate-800'
            }`}
          >
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {t(lang, 'order.balance')}
            </span>
            <span
              className={`block text-base font-bold tabular-nums ${
                bal > 0
                  ? 'text-rose-700 dark:text-rose-300'
                  : 'text-slate-900 dark:text-slate-50'
              }`}
            >
              {money(bal)}
            </span>
          </div>
        </div>

        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {t(lang, 'order.lines')}
          </h3>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {o.lines.map((l, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="min-w-0 text-slate-700 dark:text-slate-200">
                  {l.description}
                  <span className="block text-xs text-slate-400 dark:text-slate-500">
                    {l.qty} × {money(l.rate)}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums font-semibold text-slate-900 dark:text-slate-50">
                  {money(Math.round(l.qty * l.rate * 100) / 100)}
                </span>
              </li>
            ))}
          </ul>
          {o.note && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {o.note}
            </p>
          )}
        </div>

        {!done && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {t(lang, 'order.setStatus')}
            </span>
            <select
              value={o.status}
              onChange={(e) =>
                setOrderStatus(o.id, e.target.value as OrderStatus)
              }
              className={field}
            >
              {OPEN_ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(lang, `order.status.${s}`)}
                </option>
              ))}
            </select>
          </label>
        )}
        {done && (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {t(lang, `order.status.${o.status}`)}
          </p>
        )}

        {!done && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPayAmt('');
                  setPayTender('cash');
                  setMode('payment');
                }}
                className="h-11 flex-1 rounded-xl bg-slate-200 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
              >
                {t(lang, 'order.addPayment')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditId(o.id);
                  setCustId(o.customerId);
                  setLines(
                    o.lines.length ? o.lines.map((l) => ({ ...l })) : [blankLine()],
                  );
                  setDueDate(o.dueDate ?? '');
                  setFNote(o.note ?? '');
                  setMode('form');
                }}
                className="h-11 flex-1 rounded-xl bg-slate-200 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
              >
                {t(lang, 'order.edit')}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setDelTender('cash');
                setMode('deliver');
              }}
              className="h-12 w-full rounded-xl bg-teal-700 font-bold text-white"
            >
              {t(lang, 'order.deliver')}
            </button>
          </div>
        )}

        {done && o.billId && onOpenBill && (
          <button
            type="button"
            onClick={async () => {
              const s = await getSale(o.billId as string);
              if (s) onOpenBill(s);
            }}
            className="h-11 w-full rounded-xl bg-slate-200 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
          >
            {t(lang, 'cust.bill')}
          </button>
        )}

        <button
          type="button"
          onClick={async () => {
            if (window.confirm(t(lang, 'order.deleteConfirm'))) {
              await softDeleteOrder(o.id);
              setSel(null);
            }
          }}
          className="text-sm font-medium text-red-600 dark:text-red-400"
        >
          {t(lang, 'product.delete')}
        </button>
      </div>
    );
  }

  // ---- list ----
  const needle = q.trim().toLowerCase();
  const rows = orders
    .filter((o) =>
      tab === 'open'
        ? o.status !== 'delivered' && o.status !== 'cancelled'
        : o.status === 'delivered' || o.status === 'cancelled',
    )
    .filter(
      (o) =>
        !needle ||
        `${o.orderNo} ${o.customerName}`.toLowerCase().includes(needle),
    );

  const in7 = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();
  const soonCutoff = todayISO();

  return (
    <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
          {t(lang, 'order.title')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="font-medium text-teal-700 dark:text-teal-300"
        >
          {t(lang, 'settings.close')}
        </button>
      </div>

      <div className="flex gap-2">
        {(['open', 'done'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`h-9 flex-1 rounded-lg text-sm font-semibold ${
              tab === k
                ? 'bg-teal-700 text-white'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            {t(lang, k === 'open' ? 'order.openTab' : 'order.doneTab')}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t(lang, 'order.search')}
          className={`${field} flex-1`}
        />
        <button
          type="button"
          onClick={() => {
            resetForm();
            setMode('form');
          }}
          className="h-11 shrink-0 rounded-xl bg-teal-700 px-4 font-semibold text-white"
        >
          {t(lang, 'order.new')}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="pt-4 text-center text-slate-500 dark:text-slate-400">
          {t(lang, 'order.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((o) => {
            const bal = orderBalance(o);
            const overdue =
              o.status !== 'delivered' &&
              o.status !== 'cancelled' &&
              o.dueDate != null &&
              o.dueDate < soonCutoff;
            const dueSoon =
              !overdue &&
              o.status !== 'delivered' &&
              o.status !== 'cancelled' &&
              o.dueDate != null &&
              o.dueDate <= in7;
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => setSel(o.id)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900 dark:text-slate-50">
                      {o.customerName}
                    </span>
                    <span className="block text-xs text-slate-400 dark:text-slate-500">
                      {o.orderNo} · {t(lang, `order.status.${o.status}`)}
                      {o.dueDate ? ` · ${o.dueDate}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                      {money(o.total)}
                    </span>
                    {bal > 0 && (
                      <span className="block text-xs font-medium text-rose-600 dark:text-rose-400">
                        {t(lang, 'order.balance')} {money(bal)}
                      </span>
                    )}
                    {overdue ? (
                      <span className="block text-[11px] font-semibold uppercase text-rose-500">
                        {t(lang, 'order.due')}
                      </span>
                    ) : dueSoon ? (
                      <span className="block text-[11px] font-semibold uppercase text-amber-500">
                        {t(lang, 'order.due')}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
