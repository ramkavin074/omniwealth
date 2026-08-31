'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { verifyInviteTokenAction, acceptInviteAction } from '@/actions/auth';
import { Cpu, Lock, Users, Mail, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

type InviteInfo = {
  email: string;
  householdName: string;
  role: string;
};

export default function AcceptInviteCard({ token }: { token: string }) {
  const [status, setStatus] = useState<'verifying' | 'valid' | 'invalid'>('verifying');
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [verifyError, setVerifyError] = useState('');

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await verifyInviteTokenAction(token);
      if (cancelled) return;
      if (res?.success) {
        setInfo({
          email: res.email as string,
          householdName: res.householdName as string,
          role: res.role as string,
        });
        setStatus('valid');
      } else {
        setVerifyError(res?.error || 'This invitation link is invalid or has expired.');
        setStatus('invalid');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('token', token);
      formData.append('fullName', fullName);
      formData.append('password', password);

      const res = await acceptInviteAction(formData);
      if (res?.success) {
        // Session cookie is set by acceptInviteAction; refresh so the
        // dashboard request picks it up.
        router.push('/');
        router.refresh();
        return;
      }
      setError(res?.error || 'Could not accept the invitation.');
    } catch (err) {
      console.error('Accept invite error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans selection:bg-teal-600 selection:text-white">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-teal-700 rounded-xl shadow-lg shadow-teal-900/40">
            <Cpu className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">OmniWealth</h1>
            <p className="text-xs text-slate-400">Accept your invitation</p>
          </div>
        </div>

        {status === 'verifying' && (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            Verifying your invitation…
          </div>
        )}

        {status === 'invalid' && (
          <div className="space-y-4">
            <div
              role="alert"
              className="text-xs text-rose-400 bg-rose-950/50 border border-rose-800 p-2.5 rounded-lg flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {verifyError}
            </div>
            <a
              href="/login"
              className="block text-center w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm rounded-lg transition-colors"
            >
              Go to sign in
            </a>
          </div>
        )}

        {status === 'valid' && info && (
          <>
            <p className="text-sm text-slate-300 mb-5">
              You have been invited to join{' '}
              <span className="font-semibold text-white">{info.householdName}</span>. Set a
              password to finish creating your account.
            </p>

            {error ? (
              <div
                role="alert"
                aria-live="polite"
                className="text-xs text-rose-400 bg-rose-950/50 border border-rose-800 p-2.5 rounded-lg mb-4 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    value={info.email}
                    readOnly
                    disabled
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="fullName" className="block text-xs font-medium text-slate-400 mb-1">
                  Your Full Name
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    id="fullName"
                    name="fullName"
                    required
                    disabled={loading}
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="e.g. Alex Smith"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-medium text-slate-400 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    disabled={loading}
                    minLength={8}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                    autoComplete="new-password"
                    placeholder="Create a password"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-11 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-200 rounded-md transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  8+ characters, with upper &amp; lower case, a number, and a symbol.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-teal-700 hover:bg-teal-600 text-white font-semibold text-sm rounded-lg transition-colors disabled:opacity-50 mt-2 shadow-lg shadow-teal-900/30 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Creating account…' : 'Accept & Create Account'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
