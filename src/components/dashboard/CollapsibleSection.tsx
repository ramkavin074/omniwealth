'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * A dashboard card whose header is the expand/collapse control — one
 * layer, no nested card. Collapsed by default on phones (open on >= md);
 * the choice is remembered per card, per device. Collapsed content is
 * still rendered for print.
 *
 * The child component should be passed with its own outer chrome and
 * heading removed (its `embedded` / `only` prop).
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
      // Only a deliberate collapse is remembered; default is open.
      return localStorage.getItem(`omniwealth_sec_${id}`) !== '0';
    } catch {
      return true;
    }
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
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden print:border-slate-300 print:shadow-none">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-5 sm:px-6 py-4 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors print:hidden"
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

      <div
        className={
          open
            ? 'px-5 sm:px-6 pb-6 pt-1 border-t border-slate-100 dark:border-slate-800'
            : 'hidden print:block px-6 pb-6'
        }
      >
        {children}
      </div>
    </div>
  );
}
