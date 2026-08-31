'use client';

import { useEffect, useState } from 'react';
import { Lock, CheckCircle2, LogOut, Trash2, Fingerprint } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { updatePasswordAction, revokeOtherSessionsAction, deleteAccountAction } from '@/actions/auth';
import { APP_LOCK_KEY, beginInternalAuth, endInternalAuth, withTimeout } from '@/lib/applock';

export default function SecurityCard() {
  const [isNative, setIsNative] = useState(false);
  const [lockOn, setLockOn] = useState(false);
  const [lockMsg, setLockMsg] = useState('');
  const [lockBusy, setLockBusy] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
    try {
      setLockOn(localStorage.getItem(APP_LOCK_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  async function toggleAppLock() {
    if (lockBusy) return;
    setLockMsg('');

    if (lockOn) {
      try { localStorage.removeItem(APP_LOCK_KEY); } catch {}
      setLockOn(false);
      return;
    }

    // Tell the AppLock overlay to stand down while this prompt runs, so it
    // doesn't fire a second, competing biometric prompt when the app
    // backgrounds/foregrounds for the dialog.
    setLockBusy(true);
    beginInternalAuth();
    try {
      console.info('[applock] checkBiometry…');
      const bio = await BiometricAuth.checkBiometry();
      console.info('[applock] checkBiometry ok', JSON.stringify(bio));
      if (!bio.isAvailable) {
        setLockMsg('No fingerprint/face is set up on this device. Add one in Android settings, then try again.');
        return;
      }
      console.info('[applock] authenticate…');
      await withTimeout(
        // Biometric-only: no allowDeviceCredential, so the plugin uses an
        // in-place BiometricPrompt rather than a separate AuthActivity that
        // would background/foreground the app.
        BiometricAuth.authenticate({
          reason: 'Confirm to enable app lock',
          androidTitle: 'OmniWealth',
          androidSubtitle: 'Verify it’s you',
        }),
      );
      console.info('[applock] authenticate ok');
      localStorage.setItem(APP_LOCK_KEY, '1');
      setLockOn(true);
    } catch (err: any) {
      const detail = err?.message || err?.code || String(err);
      console.warn('[applock] toggle failed:', detail, err);
      setLockMsg(`App lock not enabled — ${detail}`);
    } finally {
      endInternalAuth();
      setLockBusy(false);
    }
  }

  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [sessionMsg, setSessionMsg] = useState('');
  const [sessionLoading, setSessionLoading] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delPwd, setDelPwd] = useState('');
  const [delError, setDelError] = useState('');
  const [delLoading, setDelLoading] = useState(false);

  async function handleDeleteAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!confirm('Permanently delete your account? This cannot be undone.')) return;
    setDelLoading(true);
    setDelError('');
    try {
      const fd = new FormData();
      fd.append('password', delPwd);
      const res = await deleteAccountAction(fd);
      // On success the action redirects; only errors return here.
      if (res && !res.success) setDelError(res.error || 'Failed to delete account.');
    } catch {
      setDelError('Failed to delete account.');
    } finally {
      setDelLoading(false);
    }
  }

  async function handleRevokeOthers() {
    if (!confirm('Sign out all other devices? You will stay signed in here.')) return;
    setSessionLoading(true);
    setSessionMsg('');
    try {
      const res = await revokeOtherSessionsAction();
      setSessionMsg(
        res.success
          ? `Signed out ${res.count ?? 0} other session(s).`
          : res.error || 'Failed to sign out other devices.',
      );
    } catch {
      setSessionMsg('Failed to sign out other devices.');
    } finally {
      setSessionLoading(false);
    }
  }

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

      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Active sessions</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Sign out everywhere else if a device was lost or shared.</p>
          </div>
          <button
            type="button"
            onClick={handleRevokeOthers}
            disabled={sessionLoading}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl cursor-pointer disabled:opacity-50 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            {sessionLoading ? 'Working…' : 'Sign out other devices'}
          </button>
        </div>
        {sessionMsg && (
          <p className="text-[11px] text-slate-600 dark:text-slate-300">{sessionMsg}</p>
        )}
      </div>

      {isNative && (
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Fingerprint className="w-3.5 h-3.5" /> App lock
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Require biometric / device PIN to open the app.</p>
            </div>
            <button
              type="button"
              onClick={toggleAppLock}
              disabled={lockBusy}
              className={`shrink-0 px-3 py-2 font-semibold text-xs rounded-xl cursor-pointer transition disabled:opacity-50 ${
                lockOn
                  ? 'bg-teal-700 hover:bg-teal-800 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              {lockBusy ? '…' : lockOn ? 'On' : 'Off'}
            </button>
          </div>
          {lockMsg && <p className="text-[11px] text-slate-600 dark:text-slate-300">{lockMsg}</p>}
        </div>
      )}

      <div className="pt-4 border-t border-rose-200/60 dark:border-rose-900/60 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">Delete account</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Permanently removes your account and its data. Cannot be undone.</p>
          </div>
          {!delOpen && (
            <button
              type="button"
              onClick={() => setDelOpen(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 font-semibold text-xs rounded-xl cursor-pointer transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete account
            </button>
          )}
        </div>
        {delOpen && (
          <form onSubmit={handleDeleteAccount} className="space-y-2 pt-1">
            <input
              type="password"
              value={delPwd}
              onChange={(e) => setDelPwd(e.target.value)}
              required
              placeholder="Enter your password to confirm"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-rose-200 dark:border-rose-900 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white shadow-sm focus:outline-none focus:border-rose-600"
            />
            {delError && <p className="text-[11px] text-rose-600 dark:text-rose-400">{delError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setDelOpen(false); setDelPwd(''); setDelError(''); }} className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={delLoading} className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50 transition">
                {delLoading ? 'Deleting…' : 'Permanently delete'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}