'use client';

// Used only by the standalone (Vite/APK) host. Authenticates once against the
// OmniWealth server, then caches the result so the app runs fully offline.
// The in-OmniWealth route host does its own server-side gating and renders
// <StockingApp/> directly without this component.

import { useEffect, useState, type ReactNode } from 'react';
import { API_BASE } from '../config';
import { OMNIWEALTH_LOGO } from '../logo';

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
      const stores: StoreRef[] = Array.isArray(data.stores) ? data.stores : [];
      if (stores.length === 0) {
        setError('This account has no shop access.');
        return;
      }
      // Pilot shops are one-store-per-user; if that ever changes, add a picker.
      const active = stores[0];
      const next: StoredAuth = {
        token: data.token,
        userId: data.userId,
        displayName: data.displayName,
        stores,
        storeId: active.id,
        role: active.role,
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
  if (auth) return <>{children}</>;

  const field =
    'w-full h-12 rounded-xl border border-slate-300 bg-white px-3 text-lg text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

  return (
    <div className="kadai mx-auto flex min-h-full max-w-sm flex-col justify-center gap-4 p-6 text-slate-900 dark:text-slate-100">
      <h1 className="flex items-center gap-2.5 text-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- shared module also builds under Vite (no next/image); src is an inlined data URI */}
        <img
          src={OMNIWEALTH_LOGO}
          alt="OmniWealth"
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 object-cover shadow-sm dark:border-slate-700"
        />
        <span className="k-wordmark">OmniWealth Kadai</span>
      </h1>
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
      </form>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Sign in once with an internet connection. After that the app works
        fully offline.
      </p>
    </div>
  );
}
