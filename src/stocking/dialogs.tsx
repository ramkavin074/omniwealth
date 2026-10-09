'use client';

// In-app replacements for window.confirm / window.prompt.
//
// The browser's own pop-ups are blocked or auto-dismissed in many places
// (embedded WebViews, installed web apps, automated browsers), where they
// return "cancel" silently — so a Delete tap just did nothing. These render a
// normal dialog instead. `askConfirm` / `askText` can be awaited from anywhere
// (they are not hooks); <DialogHost/> must be mounted once near the app root.
// With no host mounted (tests, non-UI code) they fall back to the native ones.

import { useEffect, useRef, useState } from 'react';
import { getLang, t } from './i18n';
import { useBackHandler } from './hooks';

type Request =
  | { id: number; kind: 'confirm'; message: string; resolve: (v: boolean) => void }
  | { id: number; kind: 'text'; message: string; initial: string; password?: boolean; resolve: (v: string | null) => void };

let nextId = 0;
let enqueue: ((r: Request) => void) | null = null;

export function askConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (enqueue) {
      enqueue({ id: ++nextId, kind: 'confirm', message, resolve });
      return;
    }
    try {
      resolve(typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(message) : false);
    } catch {
      resolve(false);
    }
  });
}

/** Resolves to the entered text, or null if the person cancelled. `password` hides what is typed. */
export function askText(message: string, initial = '', opts?: { password?: boolean }): Promise<string | null> {
  return new Promise((resolve) => {
    if (enqueue) {
      enqueue({ id: ++nextId, kind: 'text', message, initial, password: opts?.password, resolve });
      return;
    }
    try {
      resolve(typeof window !== 'undefined' && typeof window.prompt === 'function' ? window.prompt(message, initial) : null);
    } catch {
      resolve(null);
    }
  });
}

export function DialogHost() {
  const [queue, setQueue] = useState<Request[]>([]);
  const [text, setText] = useState('');
  const queueRef = useRef<Request[]>([]);
  useEffect(() => {
    queueRef.current = queue;
  });
  const cur = queue[0];

  useEffect(() => {
    enqueue = (r) => setQueue((q) => [...q, r]);
    return () => {
      enqueue = null;
      // Never leave a caller awaiting forever if the host goes away.
      for (const r of queueRef.current) (r.kind === 'confirm' ? r.resolve(false) : r.resolve(null));
    };
  }, []);

  // Start each text request with its initial value.
  useEffect(() => {
    setText(cur && cur.kind === 'text' ? cur.initial : '');
  }, [cur]);

  const finish = (ok: boolean) => {
    if (!cur) return;
    if (cur.kind === 'confirm') cur.resolve(ok);
    else cur.resolve(ok ? text : null);
    setQueue((q) => q.slice(1));
  };

  // Android Back cancels the dialog instead of leaving the screen behind it.
  useBackHandler(!!cur, () => {
    if (!cur) return false;
    finish(false);
    return true;
  });

  if (!cur) return null;
  const lang = getLang();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={() => finish(false)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={cur.message}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') finish(false);
          if (e.key === 'Enter' && cur.kind === 'text') finish(true);
        }}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900"
      >
        <p className="whitespace-pre-line text-base text-slate-900 dark:text-slate-50">{cur.message}</p>
        {cur.kind === 'text' && (
          <input
            autoFocus
            type={cur.password ? 'password' : 'text'}
            autoComplete={cur.password ? 'current-password' : 'off'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          />
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => finish(false)}
            className="h-11 rounded-lg bg-slate-200 px-4 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
          >
            {t(lang, 'dlg.cancel')}
          </button>
          <button
            type="button"
            autoFocus={cur.kind === 'confirm'}
            onClick={() => finish(true)}
            className="h-11 rounded-lg bg-teal-700 px-5 font-semibold text-white"
          >
            {t(lang, 'dlg.ok')}
          </button>
        </div>
      </div>
    </div>
  );
}
