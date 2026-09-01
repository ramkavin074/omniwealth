'use client';

import { reasonLabel, t, unitLabel, type Lang } from '../i18n';
import {
  catalogueStats,
  listProducts,
  recentMovements,
  type MovementWithName,
} from '../db/products';
import type { Product } from '../types';
import { useLiveQuery } from '../hooks';
import { SCREEN_PAD_STYLE } from '../ui';

interface Props {
  lang: Lang;
  onOpenLow: () => void;
}

function timeAgo(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export default function HomeScreen({ lang, onOpenLow }: Props) {
  const stats = useLiveQuery(() => catalogueStats(), []);
  const activity = useLiveQuery(
    () => recentMovements(40),
    [],
    [] as MovementWithName[],
  );
  // Live handle on products so the unit label per movement stays correct.
  const products = useLiveQuery(() => listProducts(), [], [] as Product[]);
  const unitOf = (id: string) =>
    products.find((p) => p.id === id)?.unit ?? 'piece';

  const money = (n: number) =>
    '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  return (
    <div className="p-4 space-y-4" style={SCREEN_PAD_STYLE}>
      <div className="grid grid-cols-2 gap-3">
        <Tile label={t(lang, 'home.products')} value={stats?.productCount ?? '—'} />
        <button
          type="button"
          onClick={onOpenLow}
          className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 text-left"
        >
          <span className="block text-sm text-amber-700 dark:text-amber-400">
            {t(lang, 'home.low')}
          </span>
          <span className="block text-2xl font-bold text-amber-800 dark:text-amber-300 tabular-nums">
            {stats?.lowCount ?? '—'}
          </span>
        </button>
        <Tile
          label={t(lang, 'home.stockValue')}
          value={stats ? money(stats.stockValue) : '—'}
        />
        <Tile
          label={t(lang, 'home.today')}
          value={stats?.movementsToday ?? '—'}
        />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
          {t(lang, 'home.activity')}
        </h2>
        {activity.length === 0 ? (
          <p className="text-slate-400 dark:text-slate-500 text-sm">
            {t(lang, 'home.noActivity')}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {activity.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-slate-900 dark:text-slate-50">
                    {m.productName}
                  </span>
                  <span className="block text-xs text-slate-400 dark:text-slate-500">
                    {reasonLabel(lang, m.reason)} · {timeAgo(m.createdAt)}
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
                  {m.delta} {unitLabel(lang, unitOf(m.productId))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
      <span className="block text-sm text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="block text-2xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">
        {value}
      </span>
    </div>
  );
}
