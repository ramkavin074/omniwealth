'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Flag, Loader2, Plus, X } from 'lucide-react';
import { addEventAction, deleteEventAction, type EventRow } from '@/actions/familyPlan';

const INPUT =
  'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-teal-600';

/** Life events pinned to the net-worth chart ("bought house", "sold car"). */
export default function ChartEvents({ events, canEdit }: { events: EventRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ label: '', eventDate: '' });

  if (events.length === 0 && !canEdit) return null;

  const run = (task: () => Promise<{ success: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError('');
      const res = await task();
      if (!res.success) {
        setError(res.error || 'Something went wrong.');
        return;
      }
      after?.();
      router.refresh();
    });

  return (
    <div className="pt-3 space-y-2">
      {events.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {[...events].reverse().map((e) => (
            <li
              key={e.id}
              className="inline-flex items-center gap-1.5 text-[11px] rounded-full border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 px-2.5 py-1 text-amber-900 dark:text-amber-200"
            >
              <Flag className="w-3 h-3" aria-hidden />
              <span className="font-semibold">{e.label}</span>
              <span className="text-amber-700/80 dark:text-amber-300/70">{e.eventDate}</span>
              {canEdit && (
                <button type="button" disabled={pending} aria-label={`Remove ${e.label}`} onClick={() => run(() => deleteEventAction(e.id))} className="ml-0.5 text-amber-700/70 hover:text-rose-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error ? <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}

      {canEdit &&
        (adding ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => addEventAction(form), () => {
                setForm({ label: '', eventDate: '' });
                setAdding(false);
              });
            }}
          >
            <input aria-label="What happened?" required maxLength={80} placeholder="e.g. Bought the house" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className={`${INPUT} flex-1 min-w-[10rem]`} />
            <input aria-label="Date" type="date" required value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} className={INPUT} />
            <button type="submit" disabled={pending} className="px-3 py-2 bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5">
              {pending && <Loader2 className="w-4 h-4 animate-spin" />} Pin it
            </button>
            <button type="button" onClick={() => setAdding(false)} className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer">
              Cancel
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Pin a life event to the timeline
          </button>
        ))}
    </div>
  );
}
