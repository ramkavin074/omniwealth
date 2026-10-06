'use client';

import { useEffect, useState } from 'react';
import { resetPasswordAction, verifyResetTokenAction } from '@/actions/auth';
import { KADAI_LOGO } from '@/stocking/logo';

/** Kadai-branded step 2 of "Forgot password?": opened from the emailed link. */
export default function ResetCard({ token }: { token: string }) {
  const [status, setStatus] = useState<'verifying' | 'valid' | 'invalid' | 'done'>(
    token ? 'verifying' : 'invalid',
  );
  const [message, setMessage] = useState(token ? '' : 'This reset link is missing or incomplete.');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    verifyResetTokenAction(token)
      .then((res) => {
        if (cancelled) return;
        if (res?.success) setStatus('valid');
        else {
          setMessage(res?.error || 'This reset link is invalid or has expired.');
          setStatus('invalid');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setMessage('Could not check the link. Check your connection and try again.');
        setStatus('invalid');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.set('token', token);
      fd.set('password', password);
      const res = await resetPasswordAction(fd);
      if (res?.success) setStatus('done');
      else setError(res?.error || 'Could not reset the password.');
    } catch {
      setError('Something went wrong. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full h-12 rounded-xl border border-slate-300 bg-white px-3 text-lg text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

  return (
    <main className="kadai mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 bg-white p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <h1 className="flex items-center gap-2.5 text-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- inlined data URI */}
        <img
          src={KADAI_LOGO}
          alt="Kadai"
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 object-cover shadow-sm dark:border-slate-700"
        />
        <span className="k-wordmark">Kadai</span>
      </h1>

      {status === 'verifying' && <p className="text-slate-500">Checking your link…</p>}

      {status === 'invalid' && (
        <>
          <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {message}
          </p>
          <p className="text-sm text-slate-500">
            Open the Kadai app and tap “Forgot password?” to get a new link.
          </p>
        </>
      )}

      {status === 'valid' && (
        <form onSubmit={submit} className="space-y-3">
          <h2 className="text-lg font-semibold">Choose a new password</h2>
          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </p>
          )}
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={field}
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Repeat the new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className={field}
          />
          <button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-xl bg-teal-700 text-lg font-bold text-white disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      )}

      {status === 'done' && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          Your password is changed. Open the Kadai app and sign in with the new password.
        </p>
      )}
    </main>
  );
}
