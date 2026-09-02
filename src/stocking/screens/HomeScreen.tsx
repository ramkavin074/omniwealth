'use client';

import { useState, type ReactNode } from 'react';
import { reasonLabel, t, unitLabel, type Lang } from '../i18n';
import {
  catalogueStats,
  listProducts,
  recentMovements,
  type MovementWithName,
} from '../db/products';
import { expiringSoon } from '../db/analytics';
import { daySummary } from '../db/sales';
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
  onOpenSales: () => void;
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

export default function HomeScreen({
  lang,
  onOpenLow,
  onOpenExpiring,
  onOpenSales,
}: Props) {
  const stats = useLiveQuery(() => catalogueStats(), []);
  const expiry = useLiveQuery(() => expiringSoon(), []);
  const today = useLiveQuery(() => daySummary(), []);
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
        <Tile
          label={t(lang, 'home.products')}
          value={stats?.productCount ?? '—'}
        />
        <Tile
          label={t(lang, 'home.low')}
          value={stats?.lowCount ?? '—'}
          tone="warn"
          onClick={onOpenLow}
        />
        <Tile
          label={t(lang, 'home.stockValue')}
          value={stats ? money(stats.stockValue) : '—'}
          sub={
            canSeeCost() && stats && stats.stockCost > 0 ? (
              <>
                {t(lang, 'home.stockCost')} {money(stats.stockCost)} ·{' '}
                {t(lang, 'home.margin')}{' '}
                <span className="text-emerald-600 dark:text-emerald-400">
                  {money(stats.marginValue)}
                </span>
              </>
            ) : undefined
          }
        />
        <Tile
          label={t(lang, 'home.today')}
          value={stats?.movementsToday ?? '—'}
        />
      </div>

      <button
        type="button"
        onClick={onOpenSales}
        className="w-full flex items-center justify-between rounded-xl bg-teal-50 px-3 py-2.5 text-sm dark:bg-teal-950/40"
      >
        <span className="font-medium text-teal-800 dark:text-teal-300">
          {t(lang, 'home.todaySales')}
        </span>
        <span className="font-semibold tabular-nums text-teal-800 dark:text-teal-300">
          {money(today?.total ?? 0)} ·{' '}
          {t(lang, 'home.bills').replace('{n}', String(today?.count ?? 0))} ›
        </span>
      </button>

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
        <h2 className="k-eyebrow mb-2 mt-1">{t(lang, 'home.activity')}</h2>
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

function Tile({
  label,
  value,
  sub,
  tone = 'plain',
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: ReactNode;
  tone?: 'plain' | 'warn' | 'accent';
  onClick?: () => void;
}) {
  const toneCls =
    tone === 'warn'
      ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
      : tone === 'accent'
        ? 'border-teal-600 bg-teal-50'
        : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';
  const valueCls =
    tone === 'warn'
      ? 'text-amber-800 dark:text-amber-300'
      : 'text-slate-900 dark:text-slate-50';
  const inner = (
    <>
      <span className="k-eyebrow block">{label}</span>
      <span
        className={`mt-1 block text-[1.7rem] font-extrabold leading-none tabular-nums ${valueCls}`}
      >
        {value}
      </span>
      {sub && (
        <span className="mt-1.5 block text-xs text-slate-400 dark:text-slate-500">
          {sub}
        </span>
      )}
    </>
  );
  const cls = `rounded-2xl border p-4 text-left transition ${toneCls} ${
    onClick ? 'active:scale-[0.98]' : ''
  }`;
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
