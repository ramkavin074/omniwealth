'use client';

import { useState } from 'react';
import { Lock, CheckCircle2 } from 'lucide-react';
import { updatePasswordAction } from '@/actions/auth';

export default function SecurityCard() {
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  async function handlePasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwdLoading(true);
    setPwdError('');
    setPwdSuccess('');

    const formData = new FormData(e.currentTarget);
    const res = await updatePasswordAction(formData);
    setPwdLoading(false);

    if (!res.success) {
      setPwdError(res.error || 'Failed to update password.');
    } else {
      setPwdSuccess('Password successfully updated!');
      (e.target as HTMLFormElement).reset();
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <Lock className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Security &amp; Password Change</h2>
      </div>

      {pwdError && <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-xl shadow-sm">{pwdError}</div>}
      {pwdSuccess && <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs p-3 rounded-xl flex items-center gap-2 shadow-sm"><CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> {pwdSuccess}</div>}

      <form onSubmit={handlePasswordChange} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1">Current Password</label>
            <input name="currentPassword" type="password" required placeholder="••••••••" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white shadow-sm focus:outline-none focus:border-teal-600" />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1">New Password</label>
            <input name="newPassword" type="password" required placeholder="••••••••" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white shadow-sm focus:outline-none focus:border-teal-600" />
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={pwdLoading} className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl cursor-pointer disabled:opacity-50 shadow-sm transition">
            {pwdLoading ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </form>
    </div>
  );
}