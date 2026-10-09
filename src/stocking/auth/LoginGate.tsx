'use client';

// Used only by the standalone (Vite/APK) host. Authenticates once against the
// OmniWealth server, then caches the result so the app runs fully offline.
// The in-OmniWealth route host does its own server-side gating and renders
// <StockingApp/> directly without this component.

import { useEffect, useState, type ReactNode } from 'react';
import { API_BASE } from '../config';
import { guardStore } from '../sync';
import { KADAI_LOGO } from '../logo';

export type StoreRole = 'owner' | 'manager' | 'staff';

interface StoreRef {
  id: string;
  name: string;
  role: StoreRole;
}

interface StoredAuth {
  token: string;
  userId: string;
  displayName: string;
  email?: string;
  stores: StoreRef[];
  storeId: string; // the active store
  role: StoreRole; // role in the active store
  savedAt: number;
}

const KEY = 'stocking.auth';

function readAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    return parsed && parsed.token && parsed.storeId ? parsed : null;
  } catch {
    return null;
  }
}

export default function LoginGate({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'signin' | 'forgot' | 'sent' | 'signup1' | 'signup2'>('signin');
  const [signName, setSignName] = useState('');
  const [shopName, setShopName] = useState('');
  const [agree, setAgree] = useState(false);
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState('');

  useEffect(() => {
    const saved = readAuth();
    // Clear another shop's leftover data before showing anything.
    (saved ? guardStore(saved.storeId) : Promise.resolve())
      .catch(() => {})
      .finally(() => {
        setAuth(saved);
        setReady(true);
      });
  }, []);

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/stocking/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setError('Could not send the email. Try again in a moment.');
        return;
      }
      setView('sent');
    } catch {
      setError('No connection. Connect to the internet and try again.');
    } finally {
      setBusy(false);
    }
  };

  /** Sign in with the given credentials; returns true when it worked. */
  const completeSignIn = async (emailVal: string, passwordVal: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/stocking/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal, password: passwordVal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Sign-in failed');
        return false;
      }
      const stores: StoreRef[] = Array.isArray(data.stores) ? data.stores : [];
      if (stores.length === 0) {
        setError('This account has no shop access.');
        return false;
      }
      // Pilot shops are one-store-per-user; if that ever changes, add a picker.
      const active = stores[0];
      const next: StoredAuth = {
        token: data.token,
        userId: data.userId,
        displayName: data.displayName,
        email: emailVal.trim().toLowerCase(),
        stores,
        storeId: active.id,
        role: active.role,
        savedAt: Date.now(),
      };
      localStorage.setItem(KEY, JSON.stringify(next));
      await guardStore(next.storeId).catch(() => {});
      setAuth(next);
      return true;
    } catch {
      setError('No connection. Connect once to sign in, then it works offline.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    await completeSignIn(email, password);
  };

  const post = async (path: string, body: unknown) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data } as { ok: boolean; data: { error?: string; ticket?: string; exists?: boolean } };
  };

  // Step 1: email a 6-digit code to prove the address is theirs.
  const startSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!agree) {
      setError('Please accept the Terms and Privacy Policy to continue.');
      return;
    }
    setBusy(true);
    try {
      const r = await post('/api/stocking/signup/start', { email, name: signName });
      if (!r.ok || !r.data.ticket) {
        setError(r.data.error || 'Could not send the code. Try again.');
        return;
      }
      setTicket(r.data.ticket);
      setCode('');
      setView('signup2');
    } catch {
      setError('No connection. Connect to the internet and try again.');
    } finally {
      setBusy(false);
    }
  };

  // Step 2: check the code, create the shop, then sign straight in.
  const finishSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const r = await post('/api/stocking/signup/finish', {
        email,
        name: signName,
        shopName,
        password,
        code,
        ticket,
        acceptTerms: agree,
      });
      if (!r.ok) {
        setError(r.data.error || 'Could not create the account. Try again.');
        return;
      }
    } catch {
      setError('No connection. Connect to the internet and try again.');
      return;
    } finally {
      setBusy(false);
    }
    await completeSignIn(email, password);
  };

  if (!ready) return null;
  if (auth) return <>{children}</>;

  const field =
    'w-full h-12 rounded-xl border border-slate-300 bg-white px-3 text-lg text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

  return (
    <div className="kadai mx-auto flex min-h-full max-w-sm flex-col justify-center gap-4 p-6 text-slate-900 dark:text-slate-100">
      <h1 className="flex items-center gap-2.5 text-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- shared module also builds under Vite (no next/image); src is an inlined data URI */}
        <img
          src={KADAI_LOGO}
          alt="Kadai"
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 object-cover shadow-sm dark:border-slate-700"
        />
        <span className="k-wordmark">Kadai</span>
      </h1>
      {view === 'signin' && (
        <form onSubmit={signIn} className="space-y-3">
          <input
            type="email"
            autoComplete="username"
            placeholder="Email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className={field}
            required
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            className={field}
            required
          />
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-xl bg-teal-700 text-lg font-bold text-white disabled:opacity-50"
          >
            {busy ? '…' : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setView('forgot');
            }}
            className="w-full py-1 text-center text-sm font-medium text-teal-700 dark:text-teal-300"
          >
            Forgot password?
          </button>
          <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
            <p className="text-center text-sm text-slate-600 dark:text-slate-300">New to Kadai?</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setView('signup1');
              }}
              className="mt-1 h-11 w-full rounded-xl border border-teal-700 text-base font-semibold text-teal-700 dark:border-teal-400 dark:text-teal-300"
            >
              Create my shop account
            </button>
          </div>
        </form>
      )}
      {view === 'signup1' && (
        <form onSubmit={startSignup} className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Create your shop account. We will email you a 6-digit code to confirm your address.
          </p>
          <input
            autoComplete="name"
            placeholder="Your name"
            value={signName}
            onChange={(ev) => setSignName(ev.target.value)}
            className={field}
            required
            minLength={2}
          />
          <input
            placeholder="Shop name"
            value={shopName}
            onChange={(ev) => setShopName(ev.target.value)}
            className={field}
            required
            minLength={2}
          />
          <input
            type="email"
            autoComplete="username"
            placeholder="Email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className={field}
            required
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Choose a password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            className={field}
            required
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            At least 8 characters with a capital letter, a small letter, a number and a symbol.
          </p>
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={agree}
              onChange={(ev) => setAgree(ev.target.checked)}
              className="mt-1 h-5 w-5 shrink-0"
            />
            <span>
              I agree to the{' '}
              <a className="text-teal-700 underline dark:text-teal-300" href="https://www.omniwealth.org/terms" target="_blank" rel="noreferrer">
                Terms
              </a>{' '}
              and{' '}
              <a className="text-teal-700 underline dark:text-teal-300" href="https://www.omniwealth.org/privacy" target="_blank" rel="noreferrer">
                Privacy Policy
              </a>
              .
            </span>
          </label>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-xl bg-teal-700 text-lg font-bold text-white disabled:opacity-50"
          >
            {busy ? '…' : 'Send me a code'}
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setView('signin');
            }}
            className="w-full py-1 text-center text-sm font-medium text-slate-500 dark:text-slate-400"
          >
            Back to sign in
          </button>
        </form>
      )}
      {view === 'signup2' && (
        <form onSubmit={finishSignup} className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            We sent a 6-digit code to <strong>{email}</strong>. Enter it below. Check your spam folder too.
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            value={code}
            onChange={(ev) => setCode(ev.target.value.replace(/\D/g, '').slice(0, 6))}
            className={`${field} text-center tracking-[0.4em]`}
            required
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="h-12 w-full rounded-xl bg-teal-700 text-lg font-bold text-white disabled:opacity-50"
          >
            {busy ? '…' : 'Create my shop'}
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setView('signup1');
            }}
            className="w-full py-1 text-center text-sm font-medium text-slate-500 dark:text-slate-400"
          >
            Change details or send a new code
          </button>
        </form>
      )}
      {view === 'forgot' && (
        <form onSubmit={sendReset} className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Enter your account email. We will send you a link to choose a new password.
          </p>
          <input
            type="email"
            autoComplete="username"
            placeholder="Email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className={field}
            required
          />
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-xl bg-teal-700 text-lg font-bold text-white disabled:opacity-50"
          >
            {busy ? '…' : 'Send reset link'}
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setView('signin');
            }}
            className="w-full py-1 text-center text-sm font-medium text-slate-500 dark:text-slate-400"
          >
            Back to sign in
          </button>
        </form>
      )}
      {view === 'sent' && (
        <div className="space-y-3">
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            If a shop account exists for that email, we have sent a reset link. It works for 20 minutes.
            Check your spam folder too. After choosing a new password, come back here and sign in.
          </p>
          <button
            type="button"
            onClick={() => setView('signin')}
            className="h-12 w-full rounded-xl bg-teal-700 text-lg font-bold text-white"
          >
            Back to sign in
          </button>
        </div>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Sign in once with an internet connection. After that the app works
        fully offline.
      </p>
    </div>
  );
}
