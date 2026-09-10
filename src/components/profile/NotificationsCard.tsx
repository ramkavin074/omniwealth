'use client';

import { useEffect, useState } from 'react';
import { Mail, BellRing } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { updateEmailDigestAction } from '@/actions/vault';
import { reminderEnabled, setWeeklyReminder } from '@/lib/reminders';

export default function NotificationsCard({ initialEmailDigest = false }: { initialEmailDigest?: boolean }) {
  const [on, setOn] = useState(initialEmailDigest);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [isNative, setIsNative] = useState(false);
  const [reminder, setReminder] = useState(false);
  const [remBusy, setRemBusy] = useState(false);
  const [remMsg, setRemMsg] = useState('');

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
    setReminder(reminderEnabled());
  }, []);

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

  async function toggleReminder() {
    const want = !reminder;
    setRemBusy(true);
    setRemMsg('');
    const applied = await setWeeklyReminder(want);
    setRemBusy(false);
    setReminder(applied);
    if (want && !applied) {
      setRemMsg('Enable notifications for OmniWealth in Settings to use reminders.');
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

      {isNative && (
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <BellRing className="w-3.5 h-3.5" /> Weekly reminder on this device
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              A local notification every Monday morning to review your wealth. Nothing leaves your phone.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleReminder}
            disabled={remBusy}
            className={`shrink-0 px-3 py-2 font-semibold text-xs rounded-xl cursor-pointer transition disabled:opacity-50 ${
              reminder
                ? 'bg-teal-700 hover:bg-teal-800 text-white'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            {reminder ? 'On' : 'Off'}
          </button>
        </div>
      )}
      {remMsg && <p className="text-[11px] text-rose-600 dark:text-rose-400">{remMsg}</p>}
    </div>
  );
}
