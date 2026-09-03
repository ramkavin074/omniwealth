'use client';

import { useMemo, useState } from 'react';
import { t, type Lang } from '../i18n';
import {
  expensesSummary,
  listExpenses,
  softDeleteExpense,
  upsertExpense,
} from '../db/expenses';
import {
  EXPENSE_CATEGORIES,
  todayISO,
  type Expense,
  type ExpenseCategory,
  type ExpenseTender,
} from '../types';
import { useLiveQuery } from '../hooks';
import { getGstConfig } from '../settings';
import { SCREEN_PAD } from '../ui';

interface Props {
  lang: Lang;
  onClose: () => void;
}

const field =
  'w-full h-11 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-slate-900 dark:text-slate-50';

const money = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const isoOf = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

export default function ExpensesScreen({ lang, onClose }: Props) {
  const rows = useLiveQuery(() => listExpenses(300), [], [] as Expense[]);
  const summary = useLiveQuery(() => expensesSummary(), [], {
    from: 0,
    to: 0,
    total: 0,
    count: 0,
    cash: 0,
    upi: 0,
    gstInput: 0,
    byCategory: [],
  });
  const gstOn = useMemo(() => getGstConfig().enabled, []);

  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editId, setEditId] = useState<string | null>(null);
  const [cat, setCat] = useState<ExpenseCategory>('rent');
  const [amount, setAmount] = useState('');
  const [tender, setTender] = useState<ExpenseTender>('cash');
  const [payee, setPayee] = useState('');
  const [note, setNote] = useState('');
  const [gstInput, setGstInput] = useState('');
  const [date, setDate] = useState(todayISO());
  const maxDate = todayISO();

  const resetForm = () => {
    setEditId(null);
    setCat('rent');
    setAmount('');
    setTender('cash');
    setPayee('');
    setNote('');
    setGstInput('');
    setDate(todayISO());
  };

  const openAdd = () => {
    resetForm();
    setMode('form');
  };

  const openEdit = (e: Expense) => {
    setEditId(e.id);
    setCat(e.category);
    setAmount(String(e.amount));
    setTender(e.tender);
    setPayee(e.payee ?? '');
    setNote(e.note ?? '');
    setGstInput(e.gstInput ? String(e.gstInput) : '');
    setDate(isoOf(e.spentAt));
    setMode('form');
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
  if (mode === 'form') {
    const amt = Number(amount);
    const canSave = Number.isFinite(amt) && amt > 0;
    const submit = async () => {
      if (!canSave) return;
      await upsertExpense({
        id: editId ?? undefined,
        category: cat,
        amount: amt,
        tender,
        payee,
        note,
        gstInput: Number(gstInput) || 0,
        // For today, let the repo stamp the real moment (a noon-pin would sit
        // in the future for a morning entry and fall outside "last 30 days").
        // A back-dated entry is pinned to noon so day-aligned ranges catch it.
        spentAt:
          !date || date === maxDate
            ? undefined
            : new Date(date + 'T12:00:00').getTime(),
      });
      resetForm();
      setMode('list');
    };
    return (
      <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
        {header(t(lang, editId ? 'exp.edit' : 'exp.add'), () => {
          resetForm();
          setMode('list');
        })}

        <div className="grid grid-cols-3 gap-2">
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`h-10 rounded-lg text-xs font-semibold ${
                cat === c
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
              }`}
            >
              {t(lang, `exp.cat.${c}`)}
            </button>
          ))}
        </div>

        <input
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder={t(lang, 'exp.amount')}
          className={field}
        />

        <div className="grid grid-cols-2 gap-2">
          {(['cash', 'upi'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTender(k)}
              className={`h-11 rounded-xl font-semibold ${
                tender === k
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
              }`}
            >
              {t(lang, `sell.tender.${k}`)}
            </button>
          ))}
        </div>

        <input
          value={payee}
          onChange={(e) => setPayee(e.target.value)}
          placeholder={t(lang, 'exp.payee')}
          className={field}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t(lang, 'adjust.note')}
          className={field}
        />
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
            {t(lang, 'exp.date')}
          </span>
          <input
            type="date"
            value={date}
            max={maxDate}
            onChange={(e) => setDate(e.target.value)}
            className={field}
          />
        </label>

        {gstOn && (
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              {t(lang, 'exp.gstInput')}
            </span>
            <input
              value={gstInput}
              onChange={(e) => setGstInput(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className={field}
            />
          </label>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!canSave}
          className="h-12 w-full rounded-xl bg-teal-700 font-bold text-white disabled:opacity-40"
        >
          {t(lang, 'product.save')}
        </button>

        {editId && (
          <button
            type="button"
            onClick={async () => {
              if (window.confirm(t(lang, 'exp.deleteConfirm'))) {
                await softDeleteExpense(editId);
                resetForm();
                setMode('list');
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
  return (
    <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
          {t(lang, 'exp.title')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="font-medium text-teal-700 dark:text-teal-300"
        >
          {t(lang, 'settings.close')}
        </button>
      </div>

      <div className="rounded-xl bg-slate-100 px-3 py-2.5 dark:bg-slate-800">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {t(lang, 'exp.thisMonth')}
          </span>
          <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {money(summary.total)}
          </span>
        </div>
        {summary.byCategory.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {summary.byCategory.slice(0, 6).map((c) => (
              <span
                key={c.category}
                className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300"
              >
                {t(lang, `exp.cat.${c.category}`)} {money(c.amount)}
              </span>
            ))}
          </div>
        )}
        {summary.cash > 0 && (
          <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
            {t(lang, 'exp.cashOut').replace('{amt}', money(summary.cash))}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={openAdd}
        className="h-11 w-full rounded-xl bg-teal-700 font-semibold text-white"
      >
        {t(lang, 'exp.add')}
      </button>

      {rows.length === 0 ? (
        <p className="pt-4 text-center text-slate-500 dark:text-slate-400">
          {t(lang, 'exp.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => openEdit(e)}
                className="flex w-full items-center justify-between gap-3 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-900 dark:text-slate-50">
                    {t(lang, `exp.cat.${e.category}`)}
                    {e.payee ? ` · ${e.payee}` : ''}
                  </span>
                  <span className="block text-xs text-slate-400 dark:text-slate-500">
                    {new Date(e.spentAt).toLocaleDateString('en-IN')} ·{' '}
                    {t(lang, `sell.tender.${e.tender}`)}
                    {e.note ? ` · ${e.note}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                  {money(e.amount)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
