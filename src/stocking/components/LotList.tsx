'use client';

import { t, type Lang } from '../i18n';
import { daysUntil } from '../types';
import { markdownPct } from '@/lib/lots';
import type { ProductLotInfo } from '../db/lots';

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** The lots on the shelf for one product, oldest expiry first. */
export default function LotList({
  lang,
  info,
  legacyDate,
}: {
  lang: Lang;
  info: ProductLotInfo | undefined;
  legacyDate: string | null;
}) {
  if (!info) return null;
  const rows: { key: string; label: string; date: string | null; qty: number }[] = [];
  if (info.untagged > 0) {
    rows.push({ key: 'older', label: t(lang, 'lot.older'), date: legacyDate, qty: info.untagged });
  }
  for (const l of info.lots) rows.push({ key: l.expiryDate, label: fmt(l.expiryDate), date: l.expiryDate, qty: l.qty });
  rows.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  if (rows.length === 0 || (info.lots.length === 0 && !legacyDate)) return null;

  return (
    <div className="space-y-1.5 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {t(lang, 'lot.title')}
      </p>
      <ul className="space-y-1 text-sm text-slate-800 dark:text-slate-100">
        {rows.map((r) => {
          const d = r.date ? daysUntil(r.date) : null;
          const pct = markdownPct(d);
          return (
            <li key={r.key} className="flex items-baseline justify-between gap-2">
              <span>
                {r.key === 'older' && r.date ? `${r.label} · ${fmt(r.date)}` : r.label}
                {d !== null ? (
                  <span className={`ml-2 text-xs ${d < 0 ? 'text-rose-600' : d <= 7 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {d === 0 ? t(lang, 'lot.today') : d < 0 ? `${Math.abs(d)}d ago` : t(lang, 'lot.days').replace('{n}', String(d))}
                    {pct > 0 ? ` · −${pct}%` : ''}
                  </span>
                ) : null}
              </span>
              <span className="font-mono tabular-nums">{t(lang, 'lot.left').replace('{n}', String(r.qty))}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
