'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, Phone, Plus, Star, Trash2 } from 'lucide-react';
import { addContactAction, deleteContactAction, type ContactRow } from '@/actions/familyPlan';
import { CONTACT_ROLES } from '@/lib/familyPlan';

const INPUT =
  'w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-teal-600';
const EMPTY = { name: '', role: 'Legacy contact', phone: '', email: '', note: '' };

export default function ContactsCard({ contacts, canManage }: { contacts: ContactRow[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY);

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
        The people your family should call first: a trusted legacy contact, the executor, your lawyer, accountant or
        advisor. They appear on the printable Family Plan.
      </p>

      {contacts.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No one added yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {contacts.map((c) => (
            <li key={c.id} className="py-3 flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  {c.isLegacy && <Star className="w-3.5 h-3.5 text-amber-500" aria-label="Legacy contact" />}
                  {c.name}
                  <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">{c.role}</span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-x-4 gap-y-0.5">
                  {c.phone && (
                    <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1 underline underline-offset-2">
                      <Phone className="w-3 h-3" /> {c.phone}
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 underline underline-offset-2 break-all">
                      <Mail className="w-3 h-3" /> {c.email}
                    </a>
                  )}
                </div>
                {c.note ? <div className="text-xs text-slate-500 dark:text-slate-400">{c.note}</div> : null}
              </div>
              {canManage && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => deleteContactAction(c.id))}
                  aria-label={`Remove ${c.name}`}
                  className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <div role="alert" className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-2.5 rounded-lg">
          {error}
        </div>
      ) : null}

      {canManage &&
        (adding ? (
          <form
            className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => addContactAction(form), () => {
                setForm(EMPTY);
                setAdding(false);
              });
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input aria-label="Name" required maxLength={80} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT} />
              <select aria-label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={INPUT}>
                {CONTACT_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <input aria-label="Phone" type="tel" maxLength={40} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={INPUT} />
              <input aria-label="Email" type="email" maxLength={120} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={INPUT} />
            </div>
            <input aria-label="Note (optional)" maxLength={200} placeholder="Note (optional), e.g. firm name, when to call" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={INPUT} />
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="px-3.5 py-2 bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-50 inline-flex items-center gap-2">
                {pending && <Loader2 className="w-4 h-4 animate-spin" />} Save contact
              </button>
              <button type="button" onClick={() => setAdding(false)} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 dark:text-teal-400 cursor-pointer">
            <Plus className="w-4 h-4" /> Add a contact
          </button>
        ))}
    </div>
  );
}
