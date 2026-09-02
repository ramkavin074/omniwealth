'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import {
  adminActivityAction,
  adminAddMemberAction,
  adminCreateStoreAction,
  adminOverviewAction,
  adminRemoveMemberAction,
  adminRevokeSessionsAction,
  adminSendResetAction,
  adminSetStoreStatusAction,
  type AdminActivityRow,
  type AdminStoreRow,
  type AdminUserRow,
} from '@/actions/admin';

type Tab = 'stores' | 'people' | 'activity';

const DORMANT_DAYS = 7;

function ago(iso: string | number | null, now: number): string {
  if (!iso) return '—';
  const t = typeof iso === 'number' ? iso : new Date(iso).getTime();
  if (!t) return '—';
  const s = Math.round((now - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
const rupee = (n: number) => '₹' + n.toLocaleString('en-IN');

const card =
  'bg-slate-900 border border-slate-800 rounded-xl';
const btn =
  'text-xs font-semibold rounded-lg px-3 py-1.5 border border-slate-700 bg-slate-950 text-slate-200 hover:text-white hover:border-slate-500 disabled:opacity-40';
const input =
  'h-9 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-teal-600 focus:outline-none';

function Pill({ kind }: { kind: string }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    trial: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    suspended: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    dormant: 'bg-slate-700/40 text-slate-400 border-slate-600/40',
    void: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    refund: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  };
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        map[kind] ?? 'bg-slate-800 text-slate-300 border-slate-700'
      }`}
    >
      {kind}
    </span>
  );
}

export default function AdminDashboardClient() {
  const [tab, setTab] = useState<Tab>('stores');
  const [now] = useState(() => Date.now());
  const [stores, setStores] = useState<AdminStoreRow[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [activity, setActivity] = useState<AdminActivityRow[]>([]);
  const [actFilter, setActFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const flash = (s: string) => {
    setMsg(s);
    setTimeout(() => setMsg(null), 6000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await adminOverviewAction();
    if (r.ok) {
      setStores(r.stores);
      setUsers(r.users);
    } else {
      flash(r.error);
    }
    setLoading(false);
  }, []);

  const loadActivity = useCallback(async (storeId?: string) => {
    const r = await adminActivityAction({ storeId, limit: 80 });
    if (r.ok) setActivity(r.rows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (tab === 'activity') loadActivity(actFilter || undefined);
  }, [tab, actFilter, loadActivity]);

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    setBusy(key);
    try {
      const r = await fn();
      if (r.ok) {
        flash(okMsg);
        await load();
      } else {
        flash(r.error ?? 'Failed.');
      }
    } catch {
      flash('Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const userName = (id: string | null) =>
    users.find((u) => u.id === id)?.name ?? '—';

  return (
    <div className="min-h-screen bg-slate-950 p-6 font-sans text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-teal-700 p-2.5 shadow-lg shadow-teal-900/40">
            <ShieldAlert className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Operator Console</h1>
            <p className="text-xs text-slate-400">
              {stores.length} store{stores.length === 1 ? '' : 's'} ·{' '}
              {users.length} people
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} className={btn}>
            Refresh
          </button>
          <Link
            href="/"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white"
          >
            Back
          </Link>
        </div>
      </header>

      <nav className="mt-6 flex gap-1 rounded-xl bg-slate-900 p-1">
        {(['stores', 'people', 'activity'] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`h-9 flex-1 rounded-lg text-sm font-semibold capitalize transition ${
              tab === k
                ? 'bg-slate-950 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {k}
          </button>
        ))}
      </nav>

      {msg && (
        <p className="mt-4 rounded-lg border border-teal-700/40 bg-teal-900/20 px-3 py-2 text-sm text-teal-200 break-all">
          {msg}
        </p>
      )}

      {loading ? (
        <p className="mt-10 text-center text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="mt-5">
          {tab === 'stores' && (
            <StoresTab
              now={now}
              stores={stores}
              users={users}
              busy={busy}
              onStatus={(id, status) =>
                run(
                  `st:${id}`,
                  () => adminSetStoreStatusAction({ storeId: id, status }),
                  `Store set to ${status}.`,
                )
              }
              onCreate={(name, ownerEmail) =>
                run(
                  'new-store',
                  () => adminCreateStoreAction({ name, ownerEmail }),
                  'Store created.',
                )
              }
              onAddMember={(storeId, email, role) =>
                run(
                  `am:${storeId}`,
                  () => adminAddMemberAction({ storeId, email, role }),
                  'Member added.',
                )
              }
            />
          )}

          {tab === 'people' && (
            <PeopleTab
              now={now}
              users={users}
              busy={busy}
              onReset={(id) =>
                run(
                  `rs:${id}`,
                  async () => {
                    const r = await adminSendResetAction({ userId: id });
                    if (r.ok && !r.sent && r.link) {
                      flash(`No mailer configured — link: ${r.link}`);
                      return { ok: true };
                    }
                    return r;
                  },
                  'Reset email sent.',
                )
              }
              onRevoke={(id) =>
                run(
                  `rv:${id}`,
                  async () => {
                    const r = await adminRevokeSessionsAction({ userId: id });
                    return r.ok
                      ? { ok: true }
                      : { ok: false, error: 'Failed.' };
                  },
                  'Sessions revoked — they must log in again.',
                )
              }
              onRemove={(storeName, storeId, userId) => {
                const st = stores.find((s) => s.name === storeName);
                if (!st) return;
                run(
                  `rm:${storeId}:${userId}`,
                  () => adminRemoveMemberAction({ storeId: st.id, userId }),
                  'Removed from store.',
                );
              }}
              stores={stores}
            />
          )}

          {tab === 'activity' && (
            <div className={`${card} p-4`}>
              <div className="mb-3 flex items-center gap-2">
                <select
                  value={actFilter}
                  onChange={(e) => setActFilter(e.target.value)}
                  className={input}
                >
                  <option value="">All stores</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-500">
                  {activity.length} events
                </span>
              </div>
              <ul className="divide-y divide-slate-800">
                {activity.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 py-2 text-sm"
                  >
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        a.kind === 'sale'
                          ? 'bg-teal-500/15 text-teal-300'
                          : 'bg-slate-700/50 text-slate-300'
                      }`}
                    >
                      {a.kind}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-slate-200">
                        {a.summary}
                      </span>
                      <span className="text-xs text-slate-500">
                        {a.store} · {userName(a.userId)} · {ago(a.when, now)}
                      </span>
                    </span>
                    {a.flag && <Pill kind={a.flag} />}
                  </li>
                ))}
                {activity.length === 0 && (
                  <li className="py-6 text-center text-sm text-slate-500">
                    No activity.
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Stores */

function StoresTab({
  now,
  stores,
  users,
  busy,
  onStatus,
  onCreate,
  onAddMember,
}: {
  now: number;
  stores: AdminStoreRow[];
  users: AdminUserRow[];
  busy: string | null;
  onStatus: (id: string, status: string) => void;
  onCreate: (name: string, ownerEmail: string) => void;
  onAddMember: (storeId: string, email: string, role: string) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [nName, setNName] = useState('');
  const [nEmail, setNEmail] = useState('');
  const [addTo, setAddTo] = useState<string | null>(null);
  const [amEmail, setAmEmail] = useState('');
  const [amRole, setAmRole] = useState('staff');

  const dormant = (iso: string | null) =>
    !iso || now - new Date(iso).getTime() > DORMANT_DAYS * 864e5;

  return (
    <div className="space-y-4">
      <div className={`${card} p-4`}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Stores</h2>
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className={btn}
          >
            {showNew ? 'Cancel' : '＋ New store'}
          </button>
        </div>
        {showNew && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              className={input}
              placeholder="Store name"
              value={nName}
              onChange={(e) => setNName(e.target.value)}
            />
            <input
              className={input}
              placeholder="Owner's OmniWealth email"
              value={nEmail}
              onChange={(e) => setNEmail(e.target.value)}
            />
            <button
              type="button"
              disabled={busy === 'new-store' || !nName || !nEmail}
              onClick={() => {
                onCreate(nName.trim(), nEmail.trim());
                setNName('');
                setNEmail('');
                setShowNew(false);
              }}
              className={`${btn} border-teal-600 text-teal-200`}
            >
              Create
            </button>
            <p className="w-full text-xs text-slate-500">
              The owner must already have an OmniWealth account. New store
              starts in <b>trial</b>.
            </p>
          </div>
        )}
      </div>

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Store</th>
              <th className="px-3 py-2.5">People</th>
              <th className="px-3 py-2.5">Items</th>
              <th className="px-3 py-2.5">Bills 7d / all</th>
              <th className="px-3 py-2.5">Sales</th>
              <th className="px-3 py-2.5">Last active</th>
              <th className="px-3 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <>
                <tr key={s.id} className="border-b border-slate-800/60">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-100">{s.name}</div>
                    <div className="text-xs text-slate-500">
                      {s.gstEnabled ? `GST · ${s.gstScheme}` : 'no GST'}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-300">
                    {s.members}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-300">
                    {s.products}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-300">
                    {s.bills7d} / {s.billsTotal}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-300">
                    {rupee(s.salesValue)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-400">
                    <span className={dormant(s.lastActivity) ? 'text-slate-600' : ''}>
                      {ago(s.lastActivity, now)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={s.status}
                      onChange={(e) => onStatus(s.id, e.target.value)}
                      disabled={busy === `st:${s.id}`}
                      className={`${input} h-8 text-xs`}
                    >
                      <option value="active">active</option>
                      <option value="trial">trial</option>
                      <option value="suspended">suspended</option>
                    </select>
                  </td>
                </tr>
                <tr key={s.id + '-x'} className="border-b border-slate-800">
                  <td colSpan={7} className="px-4 pb-2.5">
                    {addTo === s.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          className={`${input} h-8`}
                          placeholder="member email"
                          value={amEmail}
                          onChange={(e) => setAmEmail(e.target.value)}
                        />
                        <select
                          className={`${input} h-8 text-xs`}
                          value={amRole}
                          onChange={(e) => setAmRole(e.target.value)}
                        >
                          <option value="staff">staff</option>
                          <option value="manager">manager</option>
                          <option value="owner">owner</option>
                        </select>
                        <button
                          type="button"
                          disabled={busy === `am:${s.id}` || !amEmail}
                          onClick={() => {
                            onAddMember(s.id, amEmail.trim(), amRole);
                            setAmEmail('');
                            setAddTo(null);
                          }}
                          className={`${btn} border-teal-600 text-teal-200`}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddTo(null)}
                          className={btn}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAddTo(s.id);
                          setAmEmail('');
                        }}
                        className="text-xs font-semibold text-teal-400 hover:text-teal-300"
                      >
                        ＋ Add member
                      </button>
                    )}
                  </td>
                </tr>
              </>
            ))}
            {stores.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  No stores yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-600">
        {users.length} people across all stores. Suspended = loses sync &amp;
        app access, data kept.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- People */

function PeopleTab({
  now,
  users,
  stores,
  busy,
  onReset,
  onRevoke,
  onRemove,
}: {
  now: number;
  users: AdminUserRow[];
  stores: AdminStoreRow[];
  busy: string | null;
  onReset: (userId: string) => void;
  onRevoke: (userId: string) => void;
  onRemove: (storeName: string, storeId: string, userId: string) => void;
}) {
  void stores;
  const isDormant = (t: number | null) =>
    !t || now - t > DORMANT_DAYS * 864e5;

  return (
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5">Person</th>
            <th className="px-3 py-2.5">Stores</th>
            <th className="px-3 py-2.5">Last login</th>
            <th className="px-3 py-2.5">Last active</th>
            <th className="px-3 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-slate-800/60 align-top">
              <td className="px-4 py-3">
                <div className="font-medium text-slate-100">{u.name}</div>
                <div className="text-xs text-slate-500">{u.email}</div>
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap gap-1">
                  {u.memberships.map((m, i) => (
                    <span
                      key={i}
                      className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300"
                    >
                      {m.store} · {m.role}
                    </span>
                  ))}
                  {u.memberships.length === 0 && (
                    <span className="text-xs text-slate-600">none</span>
                  )}
                </div>
              </td>
              <td className="px-3 py-3 text-slate-400">{ago(u.lastLogin, now)}</td>
              <td className="px-3 py-3">
                <span
                  className={
                    isDormant(u.lastActive)
                      ? 'text-slate-600'
                      : 'text-emerald-400'
                  }
                >
                  {ago(u.lastActive, now)}
                </span>
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap justify-end gap-1.5">
                  <button
                    type="button"
                    disabled={busy === `rs:${u.id}`}
                    onClick={() => onReset(u.id)}
                    className={btn}
                  >
                    Send reset
                  </button>
                  <button
                    type="button"
                    disabled={busy === `rv:${u.id}`}
                    onClick={() => {
                      if (confirm(`Log ${u.name} out of every device?`))
                        onRevoke(u.id);
                    }}
                    className={btn}
                  >
                    Revoke sessions
                  </button>
                  {u.memberships.map((m, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (confirm(`Remove ${u.name} from ${m.store}?`))
                          onRemove(m.store, u.id, u.id);
                      }}
                      className={`${btn} border-rose-700/50 text-rose-300`}
                    >
                      Remove from {m.store}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                No store members yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
