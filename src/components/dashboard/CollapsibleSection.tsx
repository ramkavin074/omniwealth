'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Wraps a dashboard card in a tap-to-expand row. Collapsed by default on
 * phones (open on >= md) so the Wealth tab isn't one long scroll; the
 * open/closed choice is remembered per card, per device.
 */
export default function CollapsibleSection({
  id,
  title,
  icon,
  summary,
  children,
}: {
  id: string;
  title: string;
  icon?: React.ReactNode;
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(`omniwealth_sec_${id}`);
      if (v === '1') return true;
      if (v === '0') return false;
    } catch {
      /* ignore */
    }
    return typeof window !== 'undefined' ? window.innerWidth >= 768 : true;
  });

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem(`omniwealth_sec_${id}`, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer text-left print:hidden"
      >
        {icon && <span className="shrink-0 text-slate-500 dark:text-slate-400">{icon}</span>}
        <span className="flex-1 min-w-0 text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate">
          {title}
        </span>
        {summary && (
          <span className="shrink-0 text-xs font-mono text-slate-500 dark:text-slate-400">{summary}</span>
        )}
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Always render for print; on screen, only when expanded. */}
      <div className={open ? '' : 'hidden print:block'}>{children}</div>
    </div>
  );
}
