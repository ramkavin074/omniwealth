'use client';

// Used only by the standalone (Vite/APK) host. Authenticates once against the
// OmniWealth server, then caches the result so the app runs fully offline.
// The in-OmniWealth route host does its own server-side gating and renders
// <StockingApp/> directly without this component.

import { useEffect, useState, type ReactNode } from 'react';

interface StoredAuth {
  token: string;
  householdId: string;
  displayName: string;
  stockingEnabled: boolean;
  savedAt: number;
}

const KEY = 'stocking.auth';

// Empty in dev (relative path → Vite proxy); the OmniWealth origin in a
// production APK build. Set by vite.config.ts `define`.
const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) || '';

function readAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    return parsed && parsed.token ? parsed : null;
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

  useEffect(() => {
    setAuth(readAuth());
    setReady(true);
  }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/stocking/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Sign-in failed');
        return;
      }
      if (!data.stockingEnabled) {
        setError('This account does not have the stocking module enabled.');
        return;
      }
      const next: StoredAuth = {
        token: data.token,
        householdId: data.householdId,
        displayName: data.displayName,
        stockingEnabled: true,
        savedAt: Date.now(),
      };
      localStorage.setItem(KEY, JSON.stringify(next));
      setAuth(next);
    } catch {
      setError('No connection. Connect once to sign in, then it works offline.');
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return null;
  if (auth?.stockingEnabled) return <>{children}</>;

  const field =
    'w-full h-12 rounded-xl border border-slate-300 bg-white px-3 text-lg text-slate-900';

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold text-slate-900">Stock / சரக்கு</h1>
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="h-12 w-full rounded-xl bg-teal-600 text-lg font-bold text-white disabled:opacity-50"
        >
          {busy ? '…' : 'Sign in'}
        </button>
      </form>
      <p className="text-xs text-slate-500">
        Sign in once with an internet connection. After that the app works
        fully offline.
      </p>
    </div>
  );
}
