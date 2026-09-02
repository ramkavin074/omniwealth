'use server';

import crypto from 'crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { Resend } from 'resend';
import { db } from '@/db';
import {
  passwordResets,
  sessions,
  storeMembers,
  storeProducts,
  storeSales,
  storeStockMovements,
  stores,
  users,
} from '@/db/schema';
import { getSessionUserAction } from '@/actions/auth';

// Super-admin operator console. Every export gates on the caller's global
// `users.role === 'SUPER_ADMIN'` — the same check that guards /admin. These
// run ABOVE household / store scoping.

type Guard = { user: { id: string; role: string } };

async function requireSuperAdmin(): Promise<Guard | null> {
  const session = await getSessionUserAction();
  if (!session || session.user.role !== 'SUPER_ADMIN') return null;
  return { user: { id: session.user.id, role: session.user.role } };
}

const FORBIDDEN = { ok: false as const, error: 'Not authorised.' };
const ms = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STORE_ROLES = ['owner', 'manager', 'staff'] as const;
const STORE_STATUSES = ['active', 'trial', 'suspended'] as const;

// ---------------------------------------------------------------- overview

export interface AdminStoreRow {
  id: string;
  name: string;
  status: string;
  createdAt: string | null;
  members: number;
  products: number;
  billsTotal: number;
  bills7d: number;
  salesValue: number;
  lastActivity: string | null;
  gstEnabled: boolean;
  gstScheme: string;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  accountCreated: string | null;
  lastLogin: string | null;
  lastActive: number | null;
  memberships: { store: string; role: string }[];
}

export async function adminOverviewAction() {
  const g = await requireSuperAdmin();
  if (!g) return FORBIDDEN;

  const weekAgo = Date.now() - 7 * 864e5;

  const storeRows = await db.select().from(stores).orderBy(stores.name);
  const storeIds = storeRows.map((s) => s.id);

  const memberCounts = storeIds.length
    ? await db
        .select({
          storeId: storeMembers.storeId,
          n: sql<number>`count(*)::int`,
        })
        .from(storeMembers)
        .where(inArray(storeMembers.storeId, storeIds))
        .groupBy(storeMembers.storeId)
    : [];

  const productCounts = storeIds.length
    ? await db
        .select({
          storeId: storeProducts.storeId,
          n: sql<number>`count(*)::int`,
        })
        .from(storeProducts)
        .where(
          and(
            inArray(storeProducts.storeId, storeIds),
            sql`${storeProducts.deletedAt} is null`,
          ),
        )
        .groupBy(storeProducts.storeId)
    : [];

  const salesAgg = storeIds.length
    ? await db
        .select({
          storeId: storeSales.storeId,
          total: sql<number>`count(*)::int`,
          last7: sql<number>`count(*) filter (where ${storeSales.createdAt}::numeric >= ${weekAgo})::int`,
          value: sql<string>`coalesce(sum(${storeSales.total}::numeric) filter (where ${storeSales.refundOf} is null), 0)`,
          lastSync: sql<string>`max(${storeSales.syncedAt})`,
        })
        .from(storeSales)
        .where(
          and(
            inArray(storeSales.storeId, storeIds),
            sql`${storeSales.deletedAt} is null`,
          ),
        )
        .groupBy(storeSales.storeId)
    : [];

  const moveAgg = storeIds.length
    ? await db
        .select({
          storeId: storeStockMovements.storeId,
          lastSync: sql<string>`max(${storeStockMovements.syncedAt})`,
        })
        .from(storeStockMovements)
        .where(inArray(storeStockMovements.storeId, storeIds))
        .groupBy(storeStockMovements.storeId)
    : [];

  const mBy = new Map(memberCounts.map((r) => [r.storeId, r.n]));
  const pBy = new Map(productCounts.map((r) => [r.storeId, r.n]));
  const sBy = new Map(salesAgg.map((r) => [r.storeId, r]));
  const mvBy = new Map(moveAgg.map((r) => [r.storeId, r.lastSync]));

  const adminStores: AdminStoreRow[] = storeRows.map((s) => {
    const sa = sBy.get(s.id);
    const last = [sa?.lastSync, mvBy.get(s.id)]
      .filter(Boolean)
      .map((d) => new Date(d as string).getTime());
    return {
      id: s.id,
      name: s.name,
      status: s.status,
      createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : null,
      members: mBy.get(s.id) ?? 0,
      products: pBy.get(s.id) ?? 0,
      billsTotal: sa?.total ?? 0,
      bills7d: sa?.last7 ?? 0,
      salesValue: Math.round(Number(sa?.value ?? 0)),
      lastActivity: last.length
        ? new Date(Math.max(...last)).toISOString()
        : null,
      gstEnabled: s.gstEnabled,
      gstScheme: s.gstScheme,
    };
  });

  // ---- people: everyone with a store membership ----
  const memberRows = await db
    .select({
      userId: storeMembers.userId,
      storeId: storeMembers.storeId,
      role: storeMembers.role,
    })
    .from(storeMembers);
  const userIds = [...new Set(memberRows.map((m) => m.userId))];

  const userRows = userIds.length
    ? await db
        .select({
          id: users.id,
          name: users.fullName,
          email: users.email,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(inArray(users.id, userIds))
    : [];

  const loginRows = userIds.length
    ? await db
        .select({
          userId: sessions.userId,
          last: sql<string>`max(${sessions.createdAt})`,
        })
        .from(sessions)
        .where(inArray(sessions.userId, userIds))
        .groupBy(sessions.userId)
    : [];

  const activeSales = userIds.length
    ? await db
        .select({
          userId: storeSales.userId,
          last: sql<string>`max(${storeSales.syncedAt})`,
        })
        .from(storeSales)
        .where(inArray(storeSales.userId, userIds))
        .groupBy(storeSales.userId)
    : [];
  const activeMoves = userIds.length
    ? await db
        .select({
          userId: storeStockMovements.userId,
          last: sql<string>`max(${storeStockMovements.syncedAt})`,
        })
        .from(storeStockMovements)
        .where(inArray(storeStockMovements.userId, userIds))
        .groupBy(storeStockMovements.userId)
    : [];

  const storeName = new Map(storeRows.map((s) => [s.id, s.name]));
  const loginBy = new Map(loginRows.map((r) => [r.userId, r.last]));
  const actBy = new Map<string, number>();
  for (const r of [...activeSales, ...activeMoves]) {
    if (!r.userId || !r.last) continue;
    const t = new Date(r.last).getTime();
    actBy.set(r.userId, Math.max(actBy.get(r.userId) ?? 0, t));
  }

  const adminUsers: AdminUserRow[] = userRows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    accountCreated: u.createdAt ? new Date(u.createdAt).toISOString() : null,
    lastLogin: loginBy.get(u.id)
      ? new Date(loginBy.get(u.id) as string).toISOString()
      : null,
    lastActive: actBy.get(u.id) ?? null,
    memberships: memberRows
      .filter((m) => m.userId === u.id)
      .map((m) => ({ store: storeName.get(m.storeId) ?? '?', role: m.role })),
  }));
  adminUsers.sort((a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0));

  return {
    ok: true as const,
    stores: adminStores,
    users: adminUsers,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------- activity

export interface AdminActivityRow {
  kind: 'sale' | 'stock';
  store: string;
  userId: string | null;
  when: number;
  summary: string;
  flag: 'void' | 'refund' | null;
}

export async function adminActivityAction(opts?: {
  storeId?: string;
  limit?: number;
}) {
  const g = await requireSuperAdmin();
  if (!g) return FORBIDDEN;
  const limit = Math.min(Math.max(opts?.limit ?? 60, 1), 200);
  const storeFilter = opts?.storeId;

  const nameRows = await db
    .select({ id: stores.id, name: stores.name })
    .from(stores);
  const nm = new Map(nameRows.map((s) => [s.id, s.name]));

  const saleRows = await db
    .select()
    .from(storeSales)
    .where(storeFilter ? eq(storeSales.storeId, storeFilter) : sql`true`)
    .orderBy(desc(storeSales.syncedAt))
    .limit(limit);

  const moveRows = await db
    .select()
    .from(storeStockMovements)
    .where(
      storeFilter ? eq(storeStockMovements.storeId, storeFilter) : sql`true`,
    )
    .orderBy(desc(storeStockMovements.syncedAt))
    .limit(limit);

  const rows: AdminActivityRow[] = [];
  for (const s of saleRows) {
    const items = Array.isArray(s.items) ? (s.items as unknown[]) : [];
    rows.push({
      kind: 'sale',
      store: nm.get(s.storeId) ?? '?',
      userId: s.userId,
      when: ms(s.createdAt),
      summary: `${s.billNo} · ₹${ms(s.total)} · ${s.tenderType} · ${items.length} item(s)`,
      flag: s.deletedAt ? 'void' : s.refundOf ? 'refund' : null,
    });
  }
  for (const m of moveRows) {
    rows.push({
      kind: 'stock',
      store: nm.get(m.storeId) ?? '?',
      userId: m.userId,
      when: ms(m.createdAt),
      summary: `${m.reason} ${ms(m.delta) >= 0 ? '+' : ''}${ms(m.delta)}${m.note ? ` · ${m.note}` : ''}`,
      flag: null,
    });
  }
  rows.sort((a, b) => b.when - a.when);
  return { ok: true as const, rows: rows.slice(0, limit) };
}

// ---------------------------------------------------------------- provision

async function findUserByEmail(email: string) {
  const [u] = await db
    .select({ id: users.id, name: users.fullName, email: users.email })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  return u ?? null;
}

export async function adminCreateStoreAction(input: {
  name: string;
  ownerEmail: string;
  status?: string;
}) {
  const g = await requireSuperAdmin();
  if (!g) return FORBIDDEN;

  const name = String(input.name ?? '').trim();
  const email = String(input.ownerEmail ?? '').trim().toLowerCase();
  if (name.length < 2) return { ok: false as const, error: 'Name too short.' };
  if (!EMAIL_RE.test(email)) return { ok: false as const, error: 'Bad email.' };

  const owner = await findUserByEmail(email);
  if (!owner) {
    return {
      ok: false as const,
      error: 'No OmniWealth account with that email — they must sign up first.',
    };
  }

  const status = STORE_STATUSES.includes(input.status as never)
    ? (input.status as string)
    : 'trial';

  const [created] = await db
    .insert(stores)
    .values({ name, status, createdBy: g.user.id })
    .returning({ id: stores.id, name: stores.name });

  await db
    .insert(storeMembers)
    .values({ storeId: created.id, userId: owner.id, role: 'owner' })
    .onConflictDoNothing();

  return { ok: true as const, store: created, owner };
}

export async function adminAddMemberAction(input: {
  storeId: string;
  email: string;
  role: string;
}) {
  const g = await requireSuperAdmin();
  if (!g) return FORBIDDEN;

  const email = String(input.email ?? '').trim().toLowerCase();
  const role = STORE_ROLES.includes(input.role as never)
    ? input.role
    : 'staff';
  if (!EMAIL_RE.test(email)) return { ok: false as const, error: 'Bad email.' };

  const [st] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(eq(stores.id, input.storeId))
    .limit(1);
  if (!st) return { ok: false as const, error: 'Store not found.' };

  const u = await findUserByEmail(email);
  if (!u) {
    return {
      ok: false as const,
      error: 'No account with that email — they must sign up first.',
    };
  }

  await db
    .insert(storeMembers)
    .values({ storeId: input.storeId, userId: u.id, role })
    .onConflictDoUpdate({
      target: [storeMembers.storeId, storeMembers.userId],
      set: { role },
    });

  return { ok: true as const, user: u, role };
}

export async function adminRemoveMemberAction(input: {
  storeId: string;
  userId: string;
}) {
  const g = await requireSuperAdmin();
  if (!g) return FORBIDDEN;
  await db
    .delete(storeMembers)
    .where(
      and(
        eq(storeMembers.storeId, input.storeId),
        eq(storeMembers.userId, input.userId),
      ),
    );
  return { ok: true as const };
}

export async function adminSetStoreStatusAction(input: {
  storeId: string;
  status: string;
}) {
  const g = await requireSuperAdmin();
  if (!g) return FORBIDDEN;
  if (!STORE_STATUSES.includes(input.status as never)) {
    return { ok: false as const, error: 'Bad status.' };
  }
  await db
    .update(stores)
    .set({ status: input.status })
    .where(eq(stores.id, input.storeId));
  return { ok: true as const, status: input.status };
}

// ---------------------------------------------------------------- accounts

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://www.omniwealth.org'
  );
}

export async function adminSendResetAction(input: { userId: string }) {
  const g = await requireSuperAdmin();
  if (!g) return FORBIDDEN;

  const [u] = await db
    .select({ id: users.id, name: users.fullName, email: users.email })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!u) return { ok: false as const, error: 'User not found.' };

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

  await db.delete(passwordResets).where(eq(passwordResets.userId, u.id));
  await db.insert(passwordResets).values({ userId: u.id, tokenHash, expiresAt });

  const link = `${appUrl()}/login?reset-token=${encodeURIComponent(rawToken)}`;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // No mail configured — hand the link back so the operator can pass it on.
    return { ok: true as const, sent: false, link };
  }
  try {
    const resend = new Resend(key);
    await resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL ||
        'OmniWealth <onboarding@resend.dev>',
      to: [u.email],
      subject: 'Set your OmniWealth password',
      html: `<div style="font-family:Arial,sans-serif;background:#0b1220;color:#e2e8f0;padding:28px;border-radius:14px">
        <h2 style="color:#2dd4bf;margin:0 0 12px">Set your password</h2>
        <p style="font-size:14px;color:#cbd5e1">Hello ${u.name}, tap below to choose a password for your OmniWealth account. This link expires in 30 minutes.</p>
        <a href="${link}" style="display:inline-block;margin-top:14px;background:#0f766e;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:bold;font-size:14px">Set password &rarr;</a>
      </div>`,
    });
    return { ok: true as const, sent: true, link };
  } catch (e) {
    console.error('[admin] reset email failed', e);
    return { ok: true as const, sent: false, link };
  }
}

export async function adminRevokeSessionsAction(input: { userId: string }) {
  const g = await requireSuperAdmin();
  if (!g) return FORBIDDEN;
  const deleted = await db
    .delete(sessions)
    .where(eq(sessions.userId, input.userId))
    .returning({ id: sessions.id });
  return { ok: true as const, count: deleted.length };
}
