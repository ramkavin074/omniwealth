'use client';

import { useState } from 'react';
import { SHEET_OVERLAY, SHEET_PANEL } from '../ui';

interface Props {
  initial: number;
  /** Label above the display, e.g. product name or "Stock". */
  title?: string;
  unit?: string;
  allowNegative?: boolean;
  okLabel: string;
  cancelLabel: string;
  onSubmit: (value: number) => void;
  onCancel: () => void;
}

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '⌫'];

/** Big decimal keypad for loose-item quantities (kg / liter). Opened from the
 *  QtyStepper display so exact decimals don't need the OS keyboard. */
export default function Numpad({
  initial,
  title,
  unit,
  allowNegative = false,
  okLabel,
  cancelLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [str, setStr] = useState(
    initial === 0 ? '' : String(initial),
  );
  const [neg, setNeg] = useState(initial < 0);

  const press = (k: string) => {
    if (k === '⌫') {
      setStr((s) => s.slice(0, -1));
      return;
    }
    if (k === '.') {
      setStr((s) => (s.includes('.') ? s : (s === '' ? '0.' : s + '.')));
      return;
    }
    setStr((s) => {
      // avoid leading zeros like "007"
      if (s === '0') return k;
      return s + k;
    });
  };

  const value = () => {
    const n = Number((neg ? '-' : '') + (str === '' ? '0' : str));
    return Number.isFinite(n) ? n : 0;
  };

  const btn =
    'h-14 rounded-xl bg-slate-100 dark:bg-slate-800 text-2xl font-semibold text-slate-900 dark:text-slate-50 active:scale-95 transition';

  return (
    <div className={`${SHEET_OVERLAY} z-30`}>
      <div className={`${SHEET_PANEL} space-y-3`}>
        <div className="mx-auto h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700 md:hidden" />
        {title && (
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>
        )}
        <div className="flex items-center justify-end gap-2 rounded-xl border border-slate-300 px-4 py-3 dark:border-slate-600">
          <span className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {neg ? '−' : ''}
            {str === '' ? '0' : str}
          </span>
          {unit && (
            <span className="text-base font-medium text-slate-500 dark:text-slate-400">
              {unit}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <button key={k} type="button" onClick={() => press(k)} className={btn}>
              {k}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {allowNegative && (
            <button
              type="button"
              onClick={() => setNeg((n) => !n)}
              className={`${btn} flex-1 !text-xl`}
            >
              ±
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="h-14 flex-1 rounded-xl bg-slate-200 text-lg font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onSubmit(value())}
            className="h-14 flex-[2] rounded-xl bg-teal-700 text-lg font-bold text-white"
          >
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
