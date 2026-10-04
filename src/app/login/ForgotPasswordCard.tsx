'use client';

import BrandMark from '@/components/BrandMark';
import React, { useState } from 'react';
import { requestPasswordResetAction } from '@/actions/auth';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';

/** "Forgot password?" step 1: ask for the email; the reply never reveals if an account exists. */
export default function ForgotPasswordCard({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await requestPasswordResetAction(new FormData(e.currentTarget));
      setSent(true); // same message whether or not the email has an account
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans selection:bg-teal-600 selection:text-white">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <BrandMark />
          <div>
            <h1 className="text-xl font-bold text-white">Reset your password</h1>
            <p className="text-xs text-slate-400">We&rsquo;ll email you a link</p>
          </div>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-emerald-950/40 border border-emerald-900 p-4 text-sm text-emerald-200">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
              <p>
                If an account exists for that email, we&rsquo;ve sent a reset link. It expires in 20 minutes. Check your
                spam folder if you don&rsquo;t see it.
              </p>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="w-full py-2.5 bg-teal-700 hover:bg-teal-600 text-white font-semibold text-sm rounded-lg cursor-pointer transition-colors"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <div role="alert" className="text-xs text-rose-400 bg-rose-950/50 border border-rose-800 p-2.5 rounded-lg">
                {error}
              </div>
            ) : null}
            <div>
              <label htmlFor="reset-email" className="block text-xs font-medium text-slate-400 mb-1">
                Email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  required
                  disabled={loading}
                  autoComplete="email"
                  inputMode="email"
                  placeholder="user@family.com"
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
              {loading ? 'Please wait...' : 'Send reset link'}
            </button>
            <button type="button" onClick={onBack} className="w-full text-center text-xs text-slate-400 hover:text-white cursor-pointer">
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
