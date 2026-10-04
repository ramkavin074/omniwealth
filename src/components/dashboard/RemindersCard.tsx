'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BellRing, Check, Loader2, Plus, Repeat, Trash2 } from 'lucide-react';
import { addReminderAction, completeReminderAction, deleteReminderAction, type ReminderRow } from '@/actions/familyPlan';
import { REMINDER_KINDS, dueLabel, dueState } from '@/lib/familyPlan';

const INPUT =
  'w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-teal-600';
const KIND_LABEL: Record<string, string> = {
  renewal: 'Renewal',
  maturity: 'Maturity',
  expiry: 'Expiry',
  review: 'Review',
  other: 'Other',
};
const TONE = {
  overdue: 'text-rose-700 dark:text-rose-400',
  soon: 'text-amber-700 dark:text-amber-400',
  upcoming: 'text-slate-500 dark:text-slate-400',
} as const;

export default function RemindersCard({ reminders, canEdit }: { reminders: ReminderRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', kind: 'renewal', dueDate: '', repeatYearly: false, note: '' });

  const open = reminders.filter((r) => !r.doneAt);

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
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Never miss an insurance renewal, PPF maturity or document expiry. Items due within 90 days also show up in your
        insights.
      </p>

      {open.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Nothing coming up. Add the first one below.</p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {open.map((r) => {
            const state = dueState(r.dueDate);
            return (
              <li key={r.id} className="py-3 flex items-start gap-3">
                <BellRing className={`w-4 h-4 mt-0.5 shrink-0 ${TONE[state]}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white break-words">{r.title}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2">
                    <span>{KIND_LABEL[r.kind] || 'Other'}</span>
                    <span className={`font-semibold ${TONE[state]}`}>
                      {dueLabel(r.dueDate)} · {r.dueDate}
                    </span>
                    {r.repeatYearly && (
                      <span className="inline-flex items-center gap-0.5">
                        <Repeat className="w-3 h-3" /> yearly
                      </span>
                    )}
                  </div>
                  {r.note ? <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{r.note}</div> : null}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => completeReminderAction(r.id))}
                      aria-label={r.repeatYearly ? 'Done, move to next year' : 'Mark done'}
                      title={r.repeatYearly ? 'Done — moves to next year' : 'Mark done'}
                      className="p-2 text-slate-400 hover:text-emerald-600 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => deleteReminderAction(r.id))}
                      aria-label="Delete reminder"
                      className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <div role="alert" className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-2.5 rounded-lg">
          {error}
        </div>
      ) : null}

      {canEdit &&
        (adding ? (
          <form
            className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => addReminderAction(form), () => {
                setForm({ title: '', kind: 'renewal', dueDate: '', repeatYearly: false, note: '' });
                setAdding(false);
              });
            }}
          >
            <input aria-label="What is it?" required maxLength={120} placeholder="e.g. Term life insurance renewal" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={INPUT} />
            <div className="grid grid-cols-2 gap-2">
              <select aria-label="Type" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className={INPUT}>
                {REMINDER_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <input aria-label="Due date" type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={INPUT} />
            </div>
            <input aria-label="Note (optional)" maxLength={300} placeholder="Note, policy number, who to call (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={INPUT} />
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={form.repeatYearly} onChange={(e) => setForm({ ...form, repeatYearly: e.target.checked })} />
              Repeats every year (marking it done moves it to next year)
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="px-3.5 py-2 bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-50 inline-flex items-center gap-2">
                {pending && <Loader2 className="w-4 h-4 animate-spin" />} Save reminder
              </button>
              <button type="button" onClick={() => setAdding(false)} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 dark:text-teal-400 cursor-pointer">
            <Plus className="w-4 h-4" /> Add a reminder
          </button>
        ))}
    </div>
  );
}
