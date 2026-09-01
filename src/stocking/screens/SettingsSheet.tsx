'use client';

import { useState } from 'react';
import { t, unitLabel, type Lang } from '../i18n';
import { UNITS, type Unit } from '../types';
import {
  APP_VERSION,
  clearAllData,
  getDefaults,
  hasStandaloneAuth,
  setDefaults,
  signOut,
} from '../settings';

interface Props {
  lang: Lang;
  onClose: () => void;
}

const field =
  'h-11 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 text-slate-900 dark:text-slate-50';
const heading =
  'text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500';

export default function SettingsSheet({ lang, onClose }: Props) {
  const initial = getDefaults();
  const [unit, setUnit] = useState<Unit>(initial.unit);
  const [threshold, setThreshold] = useState(String(initial.lowStockThreshold));
  const standalone = hasStandaloneAuth();

  const persist = (u: Unit, thr: string) =>
    setDefaults({ unit: u, lowStockThreshold: Number(thr) || 0 });

  const wipe = async () => {
    if (!confirm(t(lang, 'settings.clearConfirm'))) return;
    await clearAllData();
    location.reload();
  };

  const logout = () => {
    signOut();
    location.reload();
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/40">
      <div
        className="mx-auto w-full max-w-md rounded-t-2xl bg-white dark:bg-slate-900 p-4 space-y-5"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
            {t(lang, 'settings.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-teal-700 dark:text-teal-300 font-medium"
          >
            {t(lang, 'settings.close')}
          </button>
        </div>

        <section className="space-y-2">
          <p className={heading}>{t(lang, 'settings.defaults')}</p>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                {t(lang, 'product.unit')}
              </span>
              <select
                value={unit}
                onChange={(e) => {
                  const u = e.target.value as Unit;
                  setUnit(u);
                  persist(u, threshold);
                }}
                className={`${field} w-full`}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {unitLabel(lang, u)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                {t(lang, 'product.lowStockThreshold')}
              </span>
              <input
                inputMode="decimal"
                value={threshold}
                onChange={(e) => {
                  setThreshold(e.target.value);
                  persist(unit, e.target.value);
                }}
                className={`${field} w-full`}
              />
            </label>
          </div>
        </section>

        <section className="space-y-2">
          <p className={heading}>{t(lang, 'settings.data')}</p>
          <button
            type="button"
            onClick={wipe}
            className="w-full h-11 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-medium"
          >
            {t(lang, 'settings.clearData')}
          </button>
        </section>

        {standalone && (
          <section className="space-y-2">
            <p className={heading}>{t(lang, 'settings.account')}</p>
            <button
              type="button"
              onClick={logout}
              className="w-full h-11 rounded-lg bg-slate-200 dark:bg-slate-700 font-medium text-slate-700 dark:text-slate-100"
            >
              {t(lang, 'settings.logout')}
            </button>
          </section>
        )}

        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          {t(lang, 'app.title')} · v{APP_VERSION}
        </p>
      </div>
    </div>
  );
}
