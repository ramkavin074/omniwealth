'use client';

import { useState } from 'react';

interface Props {
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
}

/** Large +/- stepper for counter use. Tap the number to type an exact value
 *  (handy for kg / liter). */
export default function QtyStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const round = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
  const bump = (dir: 1 | -1) => onChange(round(Math.max(min, value + dir * step)));

  const commit = () => {
    const n = Number(draft.replace(',', '.'));
    if (Number.isFinite(n)) onChange(round(Math.max(min, n)));
    setEditing(false);
  };

  return (
    <div className="flex items-stretch gap-3 select-none">
      <button
        type="button"
        onClick={() => bump(-1)}
        className="w-16 h-16 shrink-0 rounded-2xl bg-slate-200 dark:bg-slate-700 text-3xl font-bold text-slate-800 dark:text-slate-100 active:scale-95 transition"
        aria-label="decrease"
      >
        −
      </button>

      {editing ? (
        <input
          autoFocus
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="flex-1 min-w-0 h-16 text-center text-3xl font-bold rounded-2xl border-2 border-teal-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(String(value));
            setEditing(true);
          }}
          className="flex-1 min-w-0 h-16 rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-3xl font-bold text-slate-900 dark:text-slate-50 flex items-center justify-center gap-1"
        >
          <span className="tabular-nums">{value}</span>
          {suffix && (
            <span className="text-base font-medium text-slate-500 dark:text-slate-400">
              {suffix}
            </span>
          )}
        </button>
      )}

      <button
        type="button"
        onClick={() => bump(1)}
        className="w-16 h-16 shrink-0 rounded-2xl bg-teal-700 text-3xl font-bold text-white active:scale-95 transition"
        aria-label="increase"
      >
        +
      </button>
    </div>
  );
}
