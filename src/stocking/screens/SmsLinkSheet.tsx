'use client';

import { useEffect, useState } from 'react';
import { t, type Lang } from '../i18n';
import { SHEET_OVERLAY, SHEET_PANEL } from '../ui';
import { useBackHandler } from '../hooks';
import { askConfirm } from '../dialogs';
import { createSmsLink, revokeSmsLink, smsLinkStatus, type SmsLinkStatus } from '../smsLink';

const ago = (ms: number, lang: Lang) => {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  if (m < 1) return t(lang, 'sync.justNow');
  if (m < 60) return t(lang, 'sync.minsAgo').replace('{m}', String(m));
  if (m < 1440) return t(lang, 'sync.hoursAgo').replace('{h}', String(Math.round(m / 60)));
  return new Date(ms).toLocaleDateString('en-IN');
};

/** Setup for "bank SMS on iPhone": create the shop's private link and walk through the Shortcut. */
export default function SmsLinkSheet({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  useBackHandler(true, () => {
    onClose();
    return true;
  });
  const [status, setStatus] = useState<SmsLinkStatus | null | undefined>(undefined); // undefined = loading
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  // Load, then keep refreshing so "last message received" confirms the Shortcut works.
  useEffect(() => {
    let alive = true;
    const load = () =>
      void smsLinkStatus().then((s) => {
        if (alive) setStatus(s);
      });
    load();
    const id = window.setInterval(load, 5000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const create = async () => {
    if (status?.connected && !(await askConfirm(t(lang, 'sms.replaceConfirm')))) return;
    setBusy(true);
    const s = await createSmsLink();
    setBusy(false);
    if (s?.url) {
      setUrl(s.url);
      setStatus(s);
      setCopied(false);
    }
  };

  const disconnect = async () => {
    if (!(await askConfirm(t(lang, 'sms.disconnectConfirm')))) return;
    setBusy(true);
    const s = await revokeSmsLink();
    setBusy(false);
    if (s) {
      setUrl(null);
      setStatus(s);
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const steps = [1, 2, 3, 4, 5, 6].map((n) => t(lang, `sms.step${n}`));

  return (
    <div className={`${SHEET_OVERLAY} z-40`}>
      <div
        className={`${SHEET_PANEL} max-h-[92vh] space-y-3 overflow-y-auto md:max-w-2xl`}
        style={{ paddingBottom: 'calc(1rem + var(--app-safe-bottom))' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{t(lang, 'sms.title')}</h2>
          <button type="button" onClick={onClose} className="font-medium text-teal-700 dark:text-teal-300">
            {t(lang, 'settings.close')}
          </button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t(lang, 'sms.intro')}</p>

        {status === undefined && <p className="text-sm text-slate-400">…</p>}
        {status === null && (
          <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {t(lang, 'sms.offline')}
          </p>
        )}

        {status && (
          <div className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              {status.connected ? t(lang, 'sms.connected') : t(lang, 'sms.notConnected')}
            </p>
            {status.connected && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {status.lastReceivedAt
                  ? t(lang, 'sms.lastReceived').replace('{when}', ago(status.lastReceivedAt, lang))
                  : t(lang, 'sms.nothingYet')}
              </p>
            )}
          </div>
        )}

        {url && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t(lang, 'sms.yourLink')}</p>
            <textarea
              readOnly
              value={url}
              rows={3}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50"
            />
            <button
              type="button"
              onClick={copy}
              className="h-11 w-full rounded-xl bg-teal-700 font-semibold text-white"
            >
              {copied ? t(lang, 'sms.copied') : t(lang, 'sms.copy')}
            </button>
            <p className="text-xs text-amber-700 dark:text-amber-400">{t(lang, 'sms.linkOnce')}</p>
          </div>
        )}

        {status && (
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="h-11 w-full rounded-xl bg-slate-200 font-semibold text-slate-700 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-100"
          >
            {status.connected ? t(lang, 'sms.newLink') : t(lang, 'sms.createLink')}
          </button>
        )}

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{t(lang, 'sms.stepsTitle')}</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-200">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t(lang, 'sms.note')}</p>
        </div>

        {status?.connected && (
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="h-10 w-full rounded-xl text-sm font-semibold text-rose-600 dark:text-rose-400"
          >
            {t(lang, 'sms.disconnect')}
          </button>
        )}
      </div>
    </div>
  );
}
