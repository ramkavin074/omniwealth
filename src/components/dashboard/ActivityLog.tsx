'use client';

import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { fetchAuditLogAction } from '@/actions/vault';

type AuditRow = {
  id: string;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: string | null;
  createdAt: string | Date;
};

// Known actions → plain-English phrasing. Anything unmapped falls back
// to a prettified version of the raw action string.
const ACTION_LABELS: Record<string, string> = {
  'document.upload': 'Uploaded a document',
  'document.delete': 'Deleted a document',
  'asset.delete': 'Deleted an asset',
  'member.remove': 'Removed a family member',
  'account.password_change': 'Changed account password',
  'account.delete': 'Deleted an account',
  'household.currency_change': 'Changed the base currency',
  'household.pillars_update': 'Updated the legacy pillars',
  'household.retirement_update': 'Updated retirement preferences',
};

function labelFor(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  return action
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function detailFor(row: AuditRow): string {
  if (!row.meta) return '';
  try {
    const m = JSON.parse(row.meta) as Record<string, unknown>;
    if (typeof m.name === 'string') return m.name;
    if (typeof m.currency === 'string') return String(m.currency);
  } catch {
    /* meta not JSON — ignore */
  }
  return '';
}

function relativeTime(value: string | Date): string {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(value).toLocaleDateString();
}

export default function ActivityLog() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAuditLogAction(50)
      .then((r) => {
        if (!cancelled) setRows((r as AuditRow[]) || []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing recorded yet (or table not migrated) — stay out of the way.
  if (!loading && rows.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <History className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Recorded Activity</h3>
      </div>

      {loading ? (
        <div className="text-center py-6 text-xs text-slate-400 font-mono">Loading activity…</div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row) => {
            const detail = detailFor(row);
            return (
              <li key={row.id} className="py-2.5 flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-sm text-slate-800 dark:text-slate-200">
                    {labelFor(row.action)}
                    {detail && (
                      <span className="text-slate-500 dark:text-slate-400"> — {detail}</span>
                    )}
                  </span>
                  {row.actorEmail && (
                    <span className="block text-[11px] text-slate-400 dark:text-slate-500 truncate">
                      {row.actorEmail}
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-[11px] font-mono text-slate-400 dark:text-slate-500">
                  {relativeTime(row.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
