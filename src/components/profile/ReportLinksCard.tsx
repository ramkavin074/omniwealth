'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { Check, Copy, Link2, Share2 } from 'lucide-react';
import {
  createReportLinkAction,
  listReportLinksAction,
  revokeReportLinkAction,
  type ReportLinkRow,
} from '@/actions/reports';
import { nativeShare } from '@/lib/native';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function ReportLinksCard() {
  const [links, setLinks] = useState<ReportLinkRow[]>([]);
  const [days, setDays] = useState(7);
  const [label, setLabel] = useState('');
  const [created, setCreated] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    listReportLinksAction().then(setLinks).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = () => {
    setError('');
    setCreated(null);
    setCopied(false);
    startTransition(async () => {
      const res = await createReportLinkAction(days, label);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setCreated({ url: res.url, expiresAt: res.expiresAt });
      setLabel('');
      load();
    });
  };

  const revoke = (id: string) => {
    if (!window.confirm('Turn this link off? Anyone who has it will lose access.')) return;
    startTransition(async () => {
      const res = await revokeReportLinkAction(id);
      if (!res.success) setError(res.error || 'Could not revoke the link.');
      load();
    });
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy. Select the link and copy it manually.');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <Link2 className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Share a report</h2>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        Create a private, read-only link to a summary of your net worth, allocation, goals and holdings (with tickers and quantities for stocks), for example for an
        accountant. It expires automatically and you can turn it off at any time. It does{' '}
        <strong>not</strong> include account numbers, beneficiaries, notes or documents. Anyone with the link can view
        it, so share it carefully.
      </p>

      <div className="flex flex-wrap items-end gap-3 text-xs">
        <div>
          <label className="block text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1">Valid for</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white cursor-pointer"
          >
            <option value={1}>1 day</option>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
          </select>
        </div>
        <div className="flex-1 min-w-[10rem]">
          <label className="block text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Note <span className="normal-case text-slate-400">&mdash; optional, only you see it</span>
          </label>
          <input
            value={label}
            maxLength={80}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. For the accountant"
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white"
          />
        </div>
        <button
          type="button"
          onClick={create}
          disabled={pending}
          className="px-4 py-2.5 bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold rounded-xl cursor-pointer"
        >
          {pending ? 'Working…' : 'Create link'}
        </button>
      </div>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {created && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-3 space-y-2">
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            Link created. Copy it now: for your security it can&rsquo;t be shown again. Expires {fmtDate(created.expiresAt)}.
          </p>
          <input
            readOnly
            value={created.url}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={() =>
                void nativeShare({ title: 'OmniWealth report', text: 'Net worth report', url: created.url, dialogTitle: 'Share report link' })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
          </div>
        </div>
      )}

      {links.length > 0 && (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-800 dark:text-slate-200">{l.label || 'Report link'}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {l.status === 'active' ? `Expires ${fmtDate(l.expiresAt)}` : l.status === 'revoked' ? 'Turned off' : `Expired ${fmtDate(l.expiresAt)}`}
                  {' · '}
                  {l.viewCount} view{l.viewCount === 1 ? '' : 's'}
                  {l.lastViewedAt ? ` · last ${fmtDate(l.lastViewedAt)}` : ''}
                </p>
              </div>
              {l.status === 'active' ? (
                <button
                  type="button"
                  onClick={() => revoke(l.id)}
                  disabled={pending}
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer disabled:opacity-50"
                >
                  Turn off
                </button>
              ) : (
                <span className="shrink-0 text-[11px] uppercase tracking-wide text-slate-400">{l.status}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
