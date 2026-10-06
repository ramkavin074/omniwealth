'use client';

import { t, type Lang } from '../i18n';
import { markdownPct } from '@/lib/lots';
import type { ProductLotInfo } from '../db/lots';

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * Shown under a bill line: which lot to sell first, a warning if expired stock is
 * on the shelf, and a one-tap markdown for stock close to its date. Renders nothing
 * when there is nothing worth saying.
 */
export default function LotHint({
  lang,
  info,
  onApplyMarkdown,
}: {
  lang: Lang;
  info: ProductLotInfo | undefined;
  onApplyMarkdown?: (pct: number) => void;
}) {
  if (!info || !info.next || info.daysLeft === null) return null;
  const lotCount = info.lots.length + (info.untagged > 0 ? 1 : 0);
  const near = info.daysLeft <= 30;
  if (!near && lotCount < 2) return null;

  if (info.daysLeft < 0) {
    return (
      <p className="mt-1 rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
        {t(lang, 'lot.expired').replace('{date}', fmt(info.next))}
      </p>
    );
  }

  const pct = markdownPct(info.daysLeft);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <span className="font-medium">
        {t(lang, 'lot.sellFirst')
          .replace('{date}', fmt(info.next))
          .replace('{n}', String(info.nextQty))}
      </span>
      {pct > 0 && onApplyMarkdown ? (
        <button
          type="button"
          onClick={() => onApplyMarkdown(pct)}
          className="rounded-full bg-amber-200 px-2 py-0.5 font-semibold text-amber-950 dark:bg-amber-800 dark:text-amber-50"
        >
          {t(lang, 'lot.markdown').replace('{pct}', String(pct))} · {t(lang, 'lot.apply')}
        </button>
      ) : null}
    </div>
  );
}
