'use client';

import { useState } from 'react';
import { t, type Lang } from '../i18n';
import { API_BASE } from '../config';
import { SHEET_OVERLAY, SHEET_PANEL } from '../ui';

interface Props {
  lang: Lang;
  onClose: () => void;
}

interface Turn {
  q: string;
  a: string | null;
  error?: boolean;
}

function auth(): { token?: string; storeId?: string } {
  try {
    const raw = localStorage.getItem('stocking.auth');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const SUGGESTIONS_EN = [
  'What is running low?',
  "Today's top sellers?",
  'What have I not sold in a month?',
  'Which supplier do I owe the most?',
];

export default function AskAiSheet({ lang, onClose }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setQ('');
    setTurns((ts) => [...ts, { q: text, a: null }]);
    setBusy(true);
    try {
      const { token, storeId } = auth();
      const res = await fetch(`${API_BASE}/api/stocking/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(storeId ? { 'x-store-id': storeId } : {}),
        },
        credentials: token ? 'omit' : 'include',
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json().catch(() => ({}));
      setTurns((ts) =>
        ts.map((tn, i) =>
          i === ts.length - 1
            ? res.ok
              ? { ...tn, a: data.answer || '—' }
              : { ...tn, a: data.error || t(lang, 'ai.failed'), error: true }
            : tn,
        ),
      );
    } catch {
      setTurns((ts) =>
        ts.map((tn, i) =>
          i === ts.length - 1
            ? { ...tn, a: t(lang, 'ai.offline'), error: true }
            : tn,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${SHEET_OVERLAY} z-30`}>
      <div
        className={`${SHEET_PANEL} flex max-h-[85vh] flex-col`}
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
            {t(lang, 'ai.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="font-medium text-teal-700 dark:text-teal-300"
          >
            {t(lang, 'settings.close')}
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto">
          {turns.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t(lang, 'ai.intro')}
              </p>
              {SUGGESTIONS_EN.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="block w-full rounded-lg bg-slate-100 px-3 py-2 text-left text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {turns.map((tn, i) => (
            <div key={i} className="space-y-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                {tn.q}
              </p>
              <p
                className={`whitespace-pre-wrap text-sm ${
                  tn.error
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {tn.a ?? t(lang, 'ai.thinking')}
              </p>
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(q);
          }}
          className="mt-2 flex gap-2"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t(lang, 'ai.placeholder')}
            className="h-11 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50"
          />
          <button
            type="submit"
            disabled={busy || !q.trim()}
            className="h-11 rounded-xl bg-teal-700 px-4 font-semibold text-white disabled:opacity-40"
          >
            {busy ? '…' : t(lang, 'ai.send')}
          </button>
        </form>
      </div>
    </div>
  );
}
