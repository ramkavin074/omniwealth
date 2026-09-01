'use client';

import { useState } from 'react';
import { t, type Lang } from '../i18n';
import Numpad from './Numpad';

interface Props {
  lang: Lang;
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
}

/** +/- stepper for counter use. Tap the number to open a big decimal keypad
 *  (exact kg / liter entry without the OS keyboard). */
export default function QtyStepper({
  lang,
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
}: Props) {
  const [pad, setPad] = useState(false);

  const round = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
  const bump = (dir: 1 | -1) =>
    onChange(round(Math.max(min, value + dir * step)));

  return (
    <>
      <div className="flex items-stretch gap-3 select-none">
        <button
          type="button"
          onClick={() => bump(-1)}
          className="w-16 h-16 shrink-0 rounded-2xl bg-slate-200 dark:bg-slate-700 text-3xl font-bold text-slate-800 dark:text-slate-100 active:scale-95 transition"
          aria-label="decrease"
        >
          −
        </button>

        <button
          type="button"
          onClick={() => setPad(true)}
          className="flex-1 min-w-0 h-16 rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-3xl font-bold text-slate-900 dark:text-slate-50 flex items-center justify-center gap-1"
        >
          <span className="tabular-nums">{value}</span>
          {suffix && (
            <span className="text-base font-medium text-slate-500 dark:text-slate-400">
              {suffix}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => bump(1)}
          className="w-16 h-16 shrink-0 rounded-2xl bg-teal-700 text-3xl font-bold text-white active:scale-95 transition"
          aria-label="increase"
        >
          +
        </button>
      </div>

      {pad && (
        <Numpad
          initial={value}
          unit={suffix}
          allowNegative={min < 0}
          okLabel={t(lang, 'numpad.ok')}
          cancelLabel={t(lang, 'product.cancel')}
          onSubmit={(n) => {
            onChange(round(Math.max(min, n)));
            setPad(false);
          }}
          onCancel={() => setPad(false)}
        />
      )}
    </>
  );
}
