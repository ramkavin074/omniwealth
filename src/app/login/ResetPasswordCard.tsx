'use client';

import React, { useEffect, useState } from 'react';
import { resetPasswordAction, verifyResetTokenAction } from '@/actions/auth';
import { Cpu, Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

/** "Forgot password?" step 2: opened from the emailed link (/login?reset-token=...). */
export default function ResetPasswordCard({ token, onDone }: { token: string; onDone: () => void }) {
  const [status, setStatus] = useState<'verifying' | 'valid' | 'invalid' | 'done'>('verifying');
  const [verifyError, setVerifyError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await verifyResetTokenAction(token);
      if (cancelled) return;
      if (res?.success) setStatus('valid');
      else {
        setVerifyError(res?.error || 'This password reset link is invalid or has expired.');
        setStatus('invalid');
      }
    })().catch(() => {
      if (!cancelled) {
        setVerifyError('Could not check the link. Please try again.');
        setStatus('invalid');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const toSignIn = onDone;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.set('token', token);
      fd.set('password', password);
      const res = await resetPasswordAction(fd);
      if (res?.success) setStatus('done');
      else setError(res?.error || 'Could not reset the password.');
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans selection:bg-teal-600 selection:text-white">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-teal-700 rounded-xl shadow-lg shadow-teal-900/40">
            <Cpu className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Choose a new password</h1>
            <p className="text-xs text-slate-400">OmniWealth</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );

  if (status === 'verifying') {
    return shell(
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Checking your link&hellip;
      </div>,
    );
  }

  if (status === 'invalid') {
    return shell(
      <div className="space-y-4">
        <div role="alert" className="flex items-start gap-2 text-sm text-rose-300 bg-rose-950/50 border border-rose-800 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {verifyError}
        </div>
        <button
          type="button"
          onClick={toSignIn}
          className="w-full py-2.5 bg-teal-700 hover:bg-teal-600 text-white font-semibold text-sm rounded-lg cursor-pointer"
        >
          Back to sign in
        </button>
        <p className="text-center text-[11px] text-slate-500">You can request a new link with &ldquo;Forgot password?&rdquo;.</p>
      </div>,
    );
  }

  if (status === 'done') {
    return shell(
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl bg-emerald-950/40 border border-emerald-900 p-4 text-sm text-emerald-200">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
          <p>Your password has been updated. Sign in with your new password.</p>
        </div>
        <button
          type="button"
          onClick={toSignIn}
          className="w-full py-2.5 bg-teal-700 hover:bg-teal-600 text-white font-semibold text-sm rounded-lg cursor-pointer"
        >
          Go to sign in
        </button>
      </div>,
    );
  }

  return shell(
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <div role="alert" className="text-xs text-rose-400 bg-rose-950/50 border border-rose-800 p-2.5 rounded-lg">
          {error}
        </div>
      ) : null}

      <div>
        <label htmlFor="new-password" className="block text-xs font-medium text-slate-400 mb-1">
          New password
        </label>
        <div className="relative">
          <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="new-password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={8}
            disabled={loading}
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError('');
            }}
            placeholder="At least 8 characters"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-11 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-200 rounded-md cursor-pointer"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="mt-1 text-[10px] text-slate-500">8+ characters with upper and lower case, a number and a symbol.</p>
      </div>

      <div>
        <label htmlFor="confirm-password" className="block text-xs font-medium text-slate-400 mb-1">
          Confirm new password
        </label>
        <div className="relative">
          <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="confirm-password"
            type={showPassword ? 'text' : 'password'}
            required
            disabled={loading}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              if (error) setError('');
            }}
            placeholder="Type it again"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-teal-700 hover:bg-teal-600 text-white font-semibold text-sm rounded-lg cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? 'Please wait...' : 'Update password'}
      </button>
    </form>,
  );
}
