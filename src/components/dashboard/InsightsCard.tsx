'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronRight, Info } from 'lucide-react';
import type { Insight } from '@/lib/insights';

const SHOWN = 4;

export default function InsightsCard({
  insights,
  onGo,
}: {
  insights: Insight[];
  onGo: (tab: 'wealth' | 'retirement' | 'directives') => void;
}) {
  const [all, setAll] = useState(false);
  if (insights.length === 0) return null;
  const list = all ? insights : insights.slice(0, SHOWN);

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm print:hidden">
      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white mb-3">Worth a look</h4>
      <ul className="space-y-2">
        {list.map((i) => {
          const Icon = i.tone === 'attention' ? AlertTriangle : Info;
          return (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => i.tab && onGo(i.tab)}
                className="w-full flex items-start gap-3 text-left rounded-lg p-2 -mx-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
              >
                <Icon
                  className={`w-4 h-4 mt-0.5 shrink-0 ${i.tone === 'attention' ? 'text-amber-600 dark:text-amber-400' : 'text-teal-700 dark:text-teal-400'}`}
                  aria-hidden
                />
                <span className="text-sm text-slate-700 dark:text-slate-200 leading-snug flex-1">{i.text}</span>
                {i.tab && <ChevronRight className="w-4 h-4 mt-0.5 text-slate-300 shrink-0" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
      {insights.length > SHOWN && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-xs font-semibold text-teal-700 dark:text-teal-400 cursor-pointer">
          {all ? 'Show fewer' : `Show ${insights.length - SHOWN} more`}
        </button>
      )}
      <p className="mt-3 text-[10px] text-slate-400 dark:text-slate-500">Facts from your own data, not advice.</p>
    </div>
  );
}
