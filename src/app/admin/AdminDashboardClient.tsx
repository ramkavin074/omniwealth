'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import {
  adminAddMemberAction,
  adminAuditAction,
  adminCreateStoreAction,
  adminHouseholdsAction,
  adminOverviewAction,
  adminPeopleAction,
  adminRemoveMemberAction,
  adminRevokeSessionsAction,
  adminSendResetAction,
  adminSetStoreStatusAction,
  adminUnlockLoginAction,
  type AdminAuditRow,
  type AdminHouseholdRow,
  type AdminPersonRow,
  type AdminStoreRow,
} from '@/actions/admin';

type Tab = 'households' | 'stores' | 'people' | 'audit';

const DORMANT_DAYS = 7;
const STALE_DAYS = 30;

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

const card = 'bg-slate-900 border border-slate-800 rounded-xl';
const btn =
  'text-xs font-semibold rounded-lg px-3 py-1.5 border border-slate-700 bg-slate-950 text-slate-200 hover:text-white hover:border-slate-500 disabled:opacity-40';
const input =
  'h-9 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-teal-600 focus:outline-none';

function RoleTag({ role }: { role: string }) {
  const strong = role === 'SUPER_ADMIN';
  const mid = role === 'OWNER' || role === 'ADMIN';
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        strong
          ? 'bg-amber-500/15 text-amber-300'
          : mid
            ? 'bg-slate-700/60 text-slate-200'
            : 'bg-slate-800 text-slate-400'
      }`}
    >
      {role}
    </span>
  );
}

function StorePill({ status, name }: { status: string; name: string }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-300',
    trial: 'bg-amber-500/15 text-amber-300',
    suspended: 'bg-rose-500/15 text-rose-300',
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] ${
        map[status] ?? 'bg-slate-800 text-slate-300'
      }`}
    >
      {name} · {status}
    </span>
  );
}

export default function AdminDashboardClient() {
  const [tab, setTab] = useState<Tab>('households');
  const [now] = useState(() => Date.now());
  const [stores, setStores] = useState<AdminStoreRow[]>([]);
  const [houses, setHouses] = useState<AdminHouseholdRow[]>([]);
  const [people, setPeople] = useState<AdminPersonRow[]>([]);
  const [audit, setAudit] = useState<AdminAuditRow[]>([]);
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
    const [ov, hh, pp] = await Promise.all([
      adminOverviewAction(),
      adminHouseholdsAction(),
      adminPeopleAction(),
    ]);
    if (ov.ok) setStores(ov.stores);
    else flash(ov.error);
    if (hh.ok) setHouses(hh.rows);
    if (pp.ok) setPeople(pp.rows);
    setLoading(false);
  }, []);

  const loadAudit = useCallback(async (storeId?: string) => {
    const r = await adminAuditAction({ storeId, limit: 120 });
    if (r.ok) setAudit(r.rows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (tab === 'audit') loadAudit(actFilter || undefined);
  }, [tab, actFilter, loadAudit]);

  const run = async (
    key: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg: string,
  ) => {
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
    people.find((u) => u.id === id)?.name ?? (id ? id.slice(0, 8) : '—');

  const onCreateStore = (name: string, ownerEmail: string, status?: string) =>
    run(
      `new-store:${ownerEmail}`,
      () => adminCreateStoreAction({ name, ownerEmail, status }),
      'Store created.',
    );
  const onStoreStatus = (id: string, status: string) =>
    run(
      `st:${id}`,
      () => adminSetStoreStatusAction({ storeId: id, status }),
      `Store set to ${status}.`,
    );

  return (
    <div className="min-h-screen bg-slate-950 p-6 font-sans text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-teal-700 p-2.5 shadow-lg shadow-teal-900/40">
            <ShieldAlert className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">
              Platform Operator Console
            </h1>
            <p className="text-xs text-slate-400">
              {houses.length} household{houses.length === 1 ? '' : 's'} ·{' '}
              {people.length} people · {stores.length} store
              {stores.length === 1 ? '' : 's'}
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
        {(['households', 'stores', 'people', 'audit'] as Tab[]).map((k) => (
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
          {tab === 'households' && (
            <HouseholdsTab
              now={now}
              houses={houses}
              busy={busy}
              onEnableStocking={(h) =>
                onCreateStore(h.name, h.ownerEmail as string, 'trial')
              }
              onDisableStocking={(storeId) =>
                onStoreStatus(storeId, 'suspended')
              }
            />
          )}

          {tab === 'stores' && (
            <StoresTab
              now={now}
              stores={stores}
              peopleCount={people.length}
              busy={busy}
              onStatus={onStoreStatus}
              onCreate={(name, ownerEmail) => onCreateStore(name, ownerEmail)}
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
              people={people}
              stores={stores}
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
              onUnlock={(id) =>
                run(
                  `ul:${id}`,
                  () => adminUnlockLoginAction({ userId: id }),
                  'Login lock cleared.',
                )
              }
              onRemove={(storeName, userId) => {
                const st = stores.find((s) => s.name === storeName);
                if (!st) return;
                run(
                  `rm:${st.id}:${userId}`,
                  () => adminRemoveMemberAction({ storeId: st.id, userId }),
                  'Removed from store.',
                );
              }}
            />
          )}

          {tab === 'audit' && (
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
                  {audit.length} events
                </span>
                <span className="ml-auto text-xs text-slate-600">
                  account &amp; access only
                </span>
              </div>
              <ul className="divide-y divide-slate-800">
                {audit.map((a, i) => (
                  <li key={i} className="flex items-center gap-3 py-2 text-sm">
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        a.kind === 'login'
                          ? 'bg-slate-700/50 text-slate-300'
                          : 'bg-teal-500/15 text-teal-300'
                      }`}
                    >
                      {a.kind}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-slate-200">
                        {a.kind === 'login'
                          ? `${userName(a.actorId)} logged in`
                          : `${a.action}${a.detail ? ` · ${a.detail}` : ''}`}
                      </span>
                      <span className="text-xs text-slate-500">
                        {a.kind === 'admin'
                          ? `by ${userName(a.actorId)} · `
                          : ''}
                        {a.storeName ? `${a.storeName} · ` : ''}
                        {a.targetUserId && a.targetUserId !== a.actorId
                          ? `${userName(a.targetUserId)} · `
                          : ''}
                        {ago(a.when, now)}
                      </span>
                    </span>
                  </li>
                ))}
                {audit.length === 0 && (
                  <li className="py-6 text-center text-sm text-slate-500">
                    No admin activity yet.
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

/* ------------------------------------------------------------ Households */

function HouseholdsTab({
  now,
  houses,
  busy,
  onEnableStocking,
  onDisableStocking,
}: {
  now: number;
  houses: AdminHouseholdRow[];
  busy: string | null;
  onEnableStocking: (h: AdminHouseholdRow) => void;
  onDisableStocking: (storeId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Household</th>
              <th className="px-3 py-2.5">Members</th>
              <th className="px-3 py-2.5">Wealth</th>
              <th className="px-3 py-2.5">Stocking</th>
              <th className="px-3 py-2.5">Last login</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {houses.map((h) => {
              const liveStore = h.stores.find((s) => s.status !== 'suspended');
              return (
                <tr
                  key={h.id}
                  className="border-b border-slate-800/60 align-top"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-100">{h.name}</div>
                    <div className="text-xs text-slate-500">
                      {h.ownerEmail ?? 'no owner'} · since{' '}
                      {h.createdAt
                        ? new Date(h.createdAt).toLocaleDateString()
                        : '—'}
                    </div>
                  </td>
                  <td className="px-3 py-3 tabular-nums text-slate-300">
                    {h.members}
                  </td>
                  <td className="px-3 py-3">
                    {h.isStoreShell ? (
                      <span className="text-xs text-slate-500">
                        store-only
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-400">Vault</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {h.stores.length === 0 && (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                      {h.stores.map((s) => (
                        <StorePill
                          key={s.id}
                          status={s.status}
                          name={s.name}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-400">
                    {ago(h.lastLogin, now)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end">
                      {h.stores.length === 0 ? (
                        <button
                          type="button"
                          disabled={
                            !h.ownerEmail ||
                            busy === `new-store:${h.ownerEmail}`
                          }
                          onClick={() => onEnableStocking(h)}
                          className={`${btn} border-teal-600 text-teal-200`}
                          title={
                            h.ownerEmail
                              ? 'Create a trial store for this household'
                              : 'Household has no owner account'
                          }
                        >
                          ＋ Enable stocking
                        </button>
                      ) : liveStore ? (
                        <button
                          type="button"
                          disabled={busy === `st:${liveStore.id}`}
                          onClick={() => {
                            if (
                              confirm(
                                `Suspend "${liveStore.name}"? Its data is kept; the app stops working for its staff.`,
                              )
                            )
                              onDisableStocking(liveStore.id);
                          }}
                          className={`${btn} border-rose-700/50 text-rose-300`}
                        >
                          Disable stocking
                        </button>
                      ) : (
                        <span className="text-xs text-slate-600">
                          suspended
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {houses.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  No households.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-600">
        Wealth vault is on for every household unless it is a store-only shell.
        &quot;Enable stocking&quot; provisions a trial store owned by the
        household&apos;s owner; fine-tune members and status in the Stores tab.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- Stores */

function StoresTab({
  now,
  stores,
  peopleCount,
  busy,
  onStatus,
  onCreate,
  onAddMember,
}: {
  now: number;
  stores: AdminStoreRow[];
  peopleCount: number;
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
              disabled={busy?.startsWith('new-store') || !nName || !nEmail}
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
              <th className="px-3 py-2.5">Last synced</th>
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
                  <td className="px-3 py-2.5 text-slate-400">
                    <span
                      className={
                        dormant(s.lastActivity) ? 'text-slate-600' : ''
                      }
                    >
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
                  <td colSpan={5} className="px-4 pb-2.5">
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
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  No stores yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-600">
        {peopleCount} accounts on the platform. Suspended = loses sync &amp;
        app access, data kept.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- People */

const PEOPLE_FILTERS = [
  'all',
  'dormant',
  'locked',
  'super-admins',
  'store users',
  'wealth-only',
] as const;
type PeopleFilter = (typeof PEOPLE_FILTERS)[number];

function PeopleTab({
  now,
  people,
  busy,
  onReset,
  onRevoke,
  onUnlock,
  onRemove,
}: {
  now: number;
  people: AdminPersonRow[];
  stores: AdminStoreRow[];
  busy: string | null;
  onReset: (userId: string) => void;
  onRevoke: (userId: string) => void;
  onUnlock: (userId: string) => void;
  onRemove: (storeName: string, userId: string) => void;
}) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<PeopleFilter>('all');

  const ageMs = (iso: string | null) =>
    iso ? now - new Date(iso).getTime() : Infinity;
  const staleLogin = (iso: string | null) => ageMs(iso) > STALE_DAYS * 864e5;
  const freshLogin = (iso: string | null) => ageMs(iso) < DORMANT_DAYS * 864e5;

  const needle = q.trim().toLowerCase();
  const rows = people.filter((u) => {
    if (
      needle &&
      !`${u.name} ${u.email} ${u.household}`.toLowerCase().includes(needle)
    )
      return false;
    switch (filter) {
      case 'dormant':
        return staleLogin(u.lastLogin);
      case 'locked':
        return u.loginLocked;
      case 'super-admins':
        return u.role === 'SUPER_ADMIN';
      case 'store users':
        return u.stores.length > 0;
      case 'wealth-only':
        return u.stores.length === 0 && !u.isStoreShell;
      default:
        return true;
    }
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${input} min-w-[200px] flex-1`}
          placeholder="Search name, email, household"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className={input}
          value={filter}
          onChange={(e) => setFilter(e.target.value as PeopleFilter)}
        >
          {PEOPLE_FILTERS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">{rows.length} shown</span>
      </div>

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Person</th>
              <th className="px-3 py-2.5">Household</th>
              <th className="px-3 py-2.5">Stores</th>
              <th className="px-3 py-2.5">Last login</th>
              <th className="px-3 py-2.5">Sessions</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr
                key={u.id}
                className="border-b border-slate-800/60 align-top"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-100">
                      {u.name}
                    </span>
                    <RoleTag role={u.role} />
                    {u.loginLocked && (
                      <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-300">
                        locked
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </td>
                <td className="px-3 py-3 text-slate-300">
                  {u.household}
                  {u.isStoreShell && (
                    <span className="ml-1 text-xs text-slate-600">
                      (shell)
                    </span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.stores.map((m, i) => (
                      <span
                        key={i}
                        className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300"
                      >
                        {m.store} · {m.role}
                      </span>
                    ))}
                    {u.stores.length === 0 && (
                      <span className="text-xs text-slate-600">none</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={
                      freshLogin(u.lastLogin)
                        ? 'text-emerald-400'
                        : staleLogin(u.lastLogin)
                          ? 'text-slate-600'
                          : 'text-slate-400'
                    }
                  >
                    {ago(u.lastLogin, now)}
                  </span>
                </td>
                <td className="px-3 py-3 tabular-nums text-slate-400">
                  {u.activeSessions}
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
                    {u.loginLocked && (
                      <button
                        type="button"
                        disabled={busy === `ul:${u.id}`}
                        onClick={() => onUnlock(u.id)}
                        className={`${btn} border-amber-600/50 text-amber-200`}
                      >
                        Unlock login
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy === `rv:${u.id}` || u.activeSessions === 0}
                      onClick={() => {
                        if (confirm(`Log ${u.name} out of every device?`))
                          onRevoke(u.id);
                      }}
                      className={btn}
                    >
                      Revoke sessions
                    </button>
                    {u.stores.map((m, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          if (confirm(`Remove ${u.name} from ${m.store}?`))
                            onRemove(m.store, u.id);
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
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  No matching accounts.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
