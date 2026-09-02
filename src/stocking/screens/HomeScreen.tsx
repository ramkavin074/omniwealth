'use client';

import { useState } from 'react';
import { reasonLabel, t, unitLabel, type Lang } from '../i18n';
import {
  catalogueStats,
  listProducts,
  recentMovements,
  type MovementWithName,
} from '../db/products';
import { expiringSoon } from '../db/analytics';
import type { Product } from '../types';
import { db } from '../db/dexie';
import { useLiveQuery, useNow } from '../hooks';
import { canSeeCost } from '../settings';
import { SCREEN_PAD } from '../ui';
import { syncNow } from '../sync';

interface Props {
  lang: Lang;
  onOpenLow: () => void;
  onOpenExpiring: () => void;
}

function timeAgo(now: number, ms: number): string {
  if (!now) return '';
  const s = Math.round((now - ms) / 1000);
  if (s < 60) return `${Math.max(s, 0)}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export default function HomeScreen({ lang, onOpenLow, onOpenExpiring }: Props) {
  const stats = useLiveQuery(() => catalogueStats(), []);
  const expiry = useLiveQuery(() => expiringSoon(), []);
  const activity = useLiveQuery(
    () => recentMovements(40),
    [],
    [] as MovementWithName[],
  );
  // Live handle on products so the unit label per movement stays correct.
  const products = useLiveQuery(() => listProducts(), [], [] as Product[]);
  const unitOf = (id: string) =>
    products.find((p) => p.id === id)?.unit ?? 'piece';

  const now = useNow();
  const [showCost] = useState(canSeeCost);
  const sync = useLiveQuery(() => db().syncState.get('default'), []);
  const syncAgo = () => {
    if (!sync?.lastSyncAt || !now) return t(lang, 'sync.never');
    const m = Math.round((now - sync.lastSyncAt) / 60000);
    if (m < 1) return t(lang, 'sync.justNow');
    if (m < 60) return t(lang, 'sync.minsAgo').replace('{m}', String(m));
    return t(lang, 'sync.hoursAgo').replace('{h}', String(Math.round(m / 60)));
  };

  const money = (n: number) =>
    '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  return (
    <div className={`p-4 space-y-4 md:mx-auto md:max-w-3xl ${SCREEN_PAD}`}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <span className="block text-sm text-slate-500 dark:text-slate-400">
            {t(lang, 'home.stockValue')}
          </span>
          <span className="block text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {stats ? money(stats.stockValue) : '—'}
          </span>
          {canSeeCost() && stats && stats.stockCost > 0 && (
            <span className="mt-0.5 block text-xs text-slate-400 dark:text-slate-500">
              {t(lang, 'home.stockCost')} {money(stats.stockCost)} ·{' '}
              {t(lang, 'home.margin')}{' '}
              <span className="text-emerald-600 dark:text-emerald-400">
                {money(stats.marginValue)}
              </span>
            </span>
          )}
        </div>
        <Tile
          label={t(lang, 'home.today')}
          value={stats?.movementsToday ?? '—'}
        />
      </div>

      {expiry && expiry.urgent > 0 && (
        <button
          type="button"
          onClick={onOpenExpiring}
          className="w-full flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2.5 text-sm dark:bg-rose-950/40"
        >
          <span className="font-medium text-rose-700 dark:text-rose-300">
            {t(lang, 'home.expiring').replace('{n}', String(expiry.urgent))}
          </span>
          <span className="font-semibold text-rose-700 dark:text-rose-300">
            ›
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={() => syncNow()}
        className="w-full flex items-center justify-between rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm"
      >
        <span className="text-slate-500 dark:text-slate-400">
          {t(lang, 'sync.last')}: {syncAgo()}
        </span>
        <span className="font-semibold text-teal-700 dark:text-teal-400">
          {t(lang, 'sync.now')}
        </span>
      </button>

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
                    {reasonLabel(lang, m.reason)} · {timeAgo(now, m.createdAt)}
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
