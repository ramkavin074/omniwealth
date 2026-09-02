'use client';

import { useMemo, useState } from 'react';
import { reasonLabel, t, type Lang } from '../i18n';
import type { MovementReason } from '../types';
import { recentMovements, type MovementWithName } from '../db/products';
import { useDebounced, useLiveQuery, useNow } from '../hooks';
import { canSeeCost } from '../settings';
import { SCREEN_PAD } from '../ui';

interface Props {
  lang: Lang;
  onClose: () => void;
}

const REASONS: (MovementReason | 'all')[] = [
  'all',
  'scan-out',
  'scan-in',
  'manual',
  'count',
  'correction',
  'return',
  'sale-return',
  'damage',
  'expiry',
  'opening',
];

function ago(now: number, ms: number): string {
  if (!now) return '';
  const m = Math.round((now - ms) / 60000);
  if (m < 60) return `${Math.max(m, 0)}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export default function AuditScreen({ lang, onClose }: Props) {
  const now = useNow();
  const [showCost] = useState(canSeeCost);
  const [term, setTerm] = useState('');
  const [reason, setReason] = useState<MovementReason | 'all'>('all');
  const debounced = useDebounced(term, 200);

  const rows = useLiveQuery(
    () => recentMovements(500),
    [],
    [] as MovementWithName[],
  );

  const visible = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return rows.filter(
      (m) =>
        (reason === 'all' || m.reason === reason) &&
        (!q || m.productName.toLowerCase().includes(q)),
    );
  }, [rows, debounced, reason]);

  return (
    <div className={`p-4 space-y-3 ${SCREEN_PAD}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
          {t(lang, 'audit.title')}
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
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={t(lang, 'list.search')}
        className="w-full h-11 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-slate-900 dark:text-slate-50"
      />

      <div className="flex gap-1 overflow-x-auto pb-1">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              reason === r
                ? 'bg-teal-700 text-white'
                : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
            }`}
          >
            {r === 'all' ? t(lang, 'audit.all') : reasonLabel(lang, r)}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="pt-4 text-center text-slate-500 dark:text-slate-400">
          {t(lang, 'home.noActivity')}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {visible.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-slate-900 dark:text-slate-50">
                  {m.productName}
                </span>
                <span className="block text-xs text-slate-400 dark:text-slate-500">
                  {reasonLabel(lang, m.reason)} · {ago(now, m.createdAt)}
                  {showCost && m.unitCost ? ` · @₹${m.unitCost}` : ''}
                </span>
              </span>
              <span
                className={`shrink-0 tabular-nums font-semibold ${
                  m.delta >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {m.delta >= 0 ? '+' : ''}
                {m.delta} → {m.qtyAfter}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
