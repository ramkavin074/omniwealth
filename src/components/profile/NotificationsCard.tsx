'use client';

import { useState } from 'react';
import { Mail } from 'lucide-react';
import { updateEmailDigestAction } from '@/actions/vault';

export default function NotificationsCard({ initialEmailDigest = false }: { initialEmailDigest?: boolean }) {
  const [on, setOn] = useState(initialEmailDigest);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function toggle() {
    const next = !on;
    setSaving(true);
    setMsg('');
    setOn(next); // optimistic
    const res = await updateEmailDigestAction(next);
    setSaving(false);
    if (!res.success) {
      setOn(!next); // revert
      setMsg(res.error || 'Could not save.');
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <Mail className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Notifications</h2>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Weekly net-worth digest</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            A short email each week with your household net worth and the change since last time.
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          className={`shrink-0 px-3 py-2 font-semibold text-xs rounded-xl cursor-pointer transition disabled:opacity-50 ${
            on
              ? 'bg-teal-700 hover:bg-teal-800 text-white'
              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
          }`}
        >
          {on ? 'On' : 'Off'}
        </button>
      </div>
      {msg && <p className="text-[11px] text-rose-600 dark:text-rose-400">{msg}</p>}
    </div>
  );
}
