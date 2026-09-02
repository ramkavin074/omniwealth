'use server';

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { Resend } from 'resend';
import { db } from '@/db';
import {
  adminAudit,
  households,
  passwordResets,
  rateLimits,
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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STORE_ROLES = ['owner', 'manager', 'staff'] as const;
const STORE_STATUSES = ['active', 'trial', 'suspended'] as const;

async function logAudit(
  actorId: string,
  action: string,
  extra: { storeId?: string; targetUserId?: string; detail?: string } = {},
) {
  try {
    await db.insert(adminAudit).values({
      actorId,
      action,
      storeId: extra.storeId ?? null,
      targetUserId: extra.targetUserId ?? null,
      detail: extra.detail ?? null,
    });
  } catch (e) {
    console.error('[admin] audit write failed', e);
  }
}

// ---------------------------------------------------------------- overview

// Access / health only — no bill counts, no sales value, nothing that
// reveals what or how much the shop sells.
export interface AdminStoreRow {
  id: string;
  name: string;
  status: string;
  createdAt: string | null;
  members: number;
  products: number; // catalogue size — an onboarding/health signal
  lastActivity: string | null; // timestamp of last sync — "are they using it"
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

  // Last sync time only — a liveness signal, not the content or value of sales.
  const lastSyncAgg = storeIds.length
    ? await db
        .select({
          storeId: storeSales.storeId,
          lastSync: sql<string>`max(${storeSales.syncedAt})`,
        })
        .from(storeSales)
        .where(inArray(storeSales.storeId, storeIds))
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
  const syncBy = new Map(lastSyncAgg.map((r) => [r.storeId, r.lastSync]));
  const mvBy = new Map(moveAgg.map((r) => [r.storeId, r.lastSync]));

  const adminStores: AdminStoreRow[] = storeRows.map((s) => {
    const last = [syncBy.get(s.id), mvBy.get(s.id)]
      .filter(Boolean)
      .map((d) => new Date(d as string).getTime());
    return {
      id: s.id,
      name: s.name,
      status: s.status,
      createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : null,
      members: mBy.get(s.id) ?? 0,
      products: pBy.get(s.id) ?? 0,
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

// ---------------------------------------------------------------- audit

// Account / access events only: admin actions + logins. Never sales, stock,
// or anything about what the shop trades.
export interface AdminAuditRow {
  kind: 'admin' | 'login';
  action: string;
  actorId: string | null;
  targetUserId: string | null;
  storeId: string | null;
  storeName: string | null;
  detail: string | null;
  when: number;
}

export async function adminAuditAction(opts?: {
  storeId?: string;
  limit?: number;
}) {
  const g = await requireSuperAdmin();
  if (!g) return FORBIDDEN;
  const limit = Math.min(Math.max(opts?.limit ?? 80, 1), 200);
  const storeFilter = opts?.storeId;

  const nameRows = await db
    .select({ id: stores.id, name: stores.name })
    .from(stores);
  const nm = new Map(nameRows.map((s) => [s.id, s.name]));

  const auditRows = await db
    .select()
    .from(adminAudit)
    .where(storeFilter ? eq(adminAudit.storeId, storeFilter) : sql`true`)
    .orderBy(desc(adminAudit.createdAt))
    .limit(limit);

  const rows: AdminAuditRow[] = auditRows.map((a) => ({
    kind: 'admin' as const,
    action: a.action,
    actorId: a.actorId,
    targetUserId: a.targetUserId,
    storeId: a.storeId,
    storeName: a.storeId ? (nm.get(a.storeId) ?? null) : null,
    detail: a.detail,
    when: new Date(a.createdAt).getTime(),
  }));

  // Recent logins (no store scope on a session — only shown unfiltered).
  if (!storeFilter) {
    const logins = await db
      .select({ userId: sessions.userId, at: sessions.createdAt })
      .from(sessions)
      .orderBy(desc(sessions.createdAt))
      .limit(limit);
    for (const l of logins) {
      rows.push({
        kind: 'login',
        action: 'login',
        actorId: l.userId,
        targetUserId: l.userId,
        storeId: null,
        storeName: null,
        detail: null,
        when: new Date(l.at).getTime(),
      });
    }
  }

  rows.sort((a, b) => b.when - a.when);
  return { ok: true as const, rows: rows.slice(0, limit) };
}

// ---------------------------------------------------------------- households

// The "entitlements" view: every household (tenant), which modules it can
// reach — Wealth vault (every household, unless it is a store-only shell) and
// Stocking (any member belongs to a store) — plus liveness. No portfolio
// values, no balances: access matrix only.
export interface AdminHouseholdRow {
  id: string;
  name: string;
  createdAt: string | null;
  isStoreShell: boolean;
  ownerEmail: string | null;
  members: number;
  stores: { id: string; name: string; status: string }[];
  lastLogin: string | null;
}

export async function adminHouseholdsAction() {
  const g = await requireSuperAdmin();
  if (!g) return FORBIDDEN;

  const hhRows = await db.select().from(households).orderBy(households.name);

  const userRows = await db
    .select({
      id: users.id,
      householdId: users.householdId,
      email: users.email,
      role: users.role,
    })
    .from(users);

  const loginRows = await db
    .select({
      userId: sessions.userId,
      last: sql<string>`max(${sessions.createdAt})`,
    })
    .from(sessions)
    .groupBy(sessions.userId);
  const loginByUser = new Map(loginRows.map((r) => [r.userId, r.last]));

  // household → linked stores (via any member's store membership)
  const linkRows = await db
    .select({
      householdId: users.householdId,
      storeId: stores.id,
      storeName: stores.name,
      storeStatus: stores.status,
    })
    .from(storeMembers)
    .innerJoin(users, eq(users.id, storeMembers.userId))
    .innerJoin(stores, eq(stores.id, storeMembers.storeId));

  const rows: AdminHouseholdRow[] = hhRows.map((h) => {
    const mine = userRows.filter((u) => u.householdId === h.id);
    const owner =
      mine.find((u) => u.role === 'OWNER') ??
      mine.find((u) => u.role === 'SUPER_ADMIN') ??
      mine[0];
    const lastMs = mine
      .map((u) => loginByUser.get(u.id))
      .filter(Boolean)
      .map((d) => new Date(d as string).getTime());
    const storeMap = new Map<
      string,
      { id: string; name: string; status: string }
    >();
    for (const l of linkRows) {
      if (l.householdId !== h.id) continue;
      storeMap.set(l.storeId, {
        id: l.storeId,
        name: l.storeName,
        status: l.storeStatus,
      });
    }
    return {
      id: h.id,
      name: h.name,
      createdAt: h.createdAt ? new Date(h.createdAt).toISOString() : null,
      isStoreShell: h.isStoreShell,
      ownerEmail: owner?.email ?? null,
      members: mine.length,
      stores: [...storeMap.values()],
      lastLogin: lastMs.length
        ? new Date(Math.max(...lastMs)).toISOString()
        : null,
    };
  });

  return { ok: true as const, rows };
}

// ---------------------------------------------------------------- people

// Every account on the platform — not just store members. Account / access
// facts only.
export interface AdminPersonRow {
  id: string;
  name: string;
  email: string;
  role: string; // global users.role
  household: string;
  isStoreShell: boolean;
  accountCreated: string | null;
  lastLogin: string | null;
  activeSessions: number;
  stores: { store: string; role: string }[];
  loginLocked: boolean;
}

export async function adminPeopleAction() {
  const g = await requireSuperAdmin();
  if (!g) return FORBIDDEN;

  const userRows = await db
    .select({
      id: users.id,
      name: users.fullName,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      household: households.name,
      isStoreShell: households.isStoreShell,
    })
    .from(users)
    .innerJoin(households, eq(households.id, users.householdId));

  const sessionAgg = await db
    .select({
      userId: sessions.userId,
      last: sql<string>`max(${sessions.createdAt})`,
      active: sql<number>`(count(*) filter (where ${sessions.expiresAt} > now()))::int`,
    })
    .from(sessions)
    .groupBy(sessions.userId);
  const sByUser = new Map(sessionAgg.map((r) => [r.userId, r]));

  const memberRows = await db
    .select({
      userId: storeMembers.userId,
      store: stores.name,
      role: storeMembers.role,
    })
    .from(storeMembers)
    .innerJoin(stores, eq(stores.id, storeMembers.storeId));

  // Live per-account login locks (fixed-window brute-force counter).
  const lockRows = await db
    .select({ key: rateLimits.key })
    .from(rateLimits)
    .where(and(gt(rateLimits.attempts, 4), gt(rateLimits.resetAt, new Date())));
  const lockedEmails = new Set(
    lockRows
      .map((r) => r.key)
      .filter((k) => k.startsWith('login:email:'))
      .map((k) => k.slice('login:email:'.length)),
  );

  const rows: AdminPersonRow[] = userRows.map((u) => {
    const s = sByUser.get(u.id);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      household: u.household,
      isStoreShell: u.isStoreShell,
      accountCreated: u.createdAt ? new Date(u.createdAt).toISOString() : null,
      lastLogin: s?.last ? new Date(s.last).toISOString() : null,
      activeSessions: s?.active ?? 0,
      stores: memberRows
        .filter((m) => m.userId === u.id)
        .map((m) => ({ store: m.store, role: m.role })),
      loginLocked: lockedEmails.has(u.email.trim().toLowerCase()),
    };
  });
  rows.sort(
    (a, b) =>
      (b.lastLogin ? Date.parse(b.lastLogin) : 0) -
      (a.lastLogin ? Date.parse(a.lastLogin) : 0),
  );

  return { ok: true as const, rows };
}

export async function adminUnlockLoginAction(input: { userId: string }) {
  const g = await requireSuperAdmin();
  if (!g) return FORBIDDEN;
  const [u] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!u) return { ok: false as const, error: 'User not found.' };
  const email = u.email.trim().toLowerCase();
  const cleared = await db
    .delete(rateLimits)
    .where(inArray(rateLimits.key, [`login:email:${email}`]))
    .returning({ key: rateLimits.key });
  await logAudit(g.user.id, 'account.login-unlocked', {
    targetUserId: input.userId,
    detail: email,
  });
  return { ok: true as const, cleared: cleared.length };
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

  await logAudit(g.user.id, 'store.create', {
    storeId: created.id,
    targetUserId: owner.id,
    detail: `${created.name} · owner ${owner.email} · status ${status}`,
  });

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

  await logAudit(g.user.id, 'member.add', {
    storeId: input.storeId,
    targetUserId: u.id,
    detail: `${u.email} as ${role}`,
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
  await logAudit(g.user.id, 'member.remove', {
    storeId: input.storeId,
    targetUserId: input.userId,
  });
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
  await logAudit(g.user.id, 'store.status', {
    storeId: input.storeId,
    detail: `→ ${input.status}`,
  });
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

// Mint a 30-minute set-password link for a user, delivering it by email when a
// mailer is configured. The link is always returned so the operator can also
// hand it over directly (WhatsApp, in person).
async function issueSetPasswordLink(
  userId: string,
  name: string,
  email: string,
): Promise<{ link: string; sent: boolean }> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

  await db.delete(passwordResets).where(eq(passwordResets.userId, userId));
  await db.insert(passwordResets).values({ userId, tokenHash, expiresAt });

  const link = `${appUrl()}/login?reset-token=${encodeURIComponent(rawToken)}`;
  const key = process.env.RESEND_API_KEY;
  if (!key) return { link, sent: false };
  try {
    const resend = new Resend(key);
    await resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL || 'OmniWealth <onboarding@resend.dev>',
      to: [email],
      subject: 'Set your OmniWealth password',
      html: `<div style="font-family:Arial,sans-serif;background:#0b1220;color:#e2e8f0;padding:28px;border-radius:14px">
        <h2 style="color:#2dd4bf;margin:0 0 12px">Set your password</h2>
        <p style="font-size:14px;color:#cbd5e1">Hello ${name}, tap below to choose a password for your OmniWealth account. This link expires in 30 minutes.</p>
        <a href="${link}" style="display:inline-block;margin-top:14px;background:#0f766e;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:bold;font-size:14px">Set password &rarr;</a>
      </div>`,
    });
    return { link, sent: true };
  } catch (e) {
    console.error('[admin] set-password email failed', e);
    return { link, sent: false };
  }
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

  await logAudit(g.user.id, 'account.reset-sent', {
    targetUserId: u.id,
    detail: u.email,
  });
  const { link, sent } = await issueSetPasswordLink(u.id, u.name, u.email);
  return { ok: true as const, sent, link };
}

// Create a brand-new account for a Kadai-first shopkeeper: a store-shell
// household + the user + (optionally) their store with an owner membership,
// then a set-password link to hand over. No self-signup exists for Kadai.
export async function adminCreateAccountAction(input: {
  fullName: string;
  email: string;
  storeName?: string;
}) {
  const g = await requireSuperAdmin();
  if (!g) return FORBIDDEN;

  const fullName = String(input.fullName ?? '').trim();
  const email = String(input.email ?? '')
    .trim()
    .toLowerCase();
  const storeName = String(input.storeName ?? '').trim();
  if (fullName.length < 2)
    return { ok: false as const, error: 'Name is too short.' };
  if (!EMAIL_RE.test(email))
    return { ok: false as const, error: 'Enter a valid email.' };
  if (storeName && storeName.length < 2)
    return { ok: false as const, error: 'Store name is too short.' };

  if (await findUserByEmail(email))
    return {
      ok: false as const,
      error: 'An account with that email already exists.',
    };

  // Unusable random password — the person sets a real one via the link.
  const passwordHash = await bcrypt.hash(
    crypto.randomBytes(24).toString('hex'),
    10,
  );

  let made: { userId: string; store: { id: string; name: string } | null };
  try {
    made = await db.transaction(async (tx) => {
      const [hh] = await tx
        .insert(households)
        .values({
          name: storeName || `${fullName}'s shop`,
          isStoreShell: true,
        })
        .returning({ id: households.id });
      const [u] = await tx
        .insert(users)
        .values({ householdId: hh.id, email, passwordHash, fullName })
        .returning({ id: users.id });
      let store: { id: string; name: string } | null = null;
      if (storeName) {
        const [s] = await tx
          .insert(stores)
          .values({ name: storeName, status: 'trial', createdBy: g.user.id })
          .returning({ id: stores.id, name: stores.name });
        store = s;
        await tx
          .insert(storeMembers)
          .values({ storeId: s.id, userId: u.id, role: 'owner' });
      }
      return { userId: u.id, store };
    });
  } catch (e) {
    console.error('[admin] create account failed', e);
    return {
      ok: false as const,
      error: 'Could not create the account (the email may already be taken).',
    };
  }

  await logAudit(g.user.id, 'account.create', {
    targetUserId: made.userId,
    storeId: made.store?.id,
    detail: storeName ? `${email} · store "${storeName}"` : email,
  });

  const { link, sent } = await issueSetPasswordLink(made.userId, fullName, email);
  return {
    ok: true as const,
    user: { id: made.userId, email, fullName },
    store: made.store,
    link,
    sent,
  };
}

export async function adminRevokeSessionsAction(input: { userId: string }) {
  const g = await requireSuperAdmin();
  if (!g) return FORBIDDEN;
  const deleted = await db
    .delete(sessions)
    .where(eq(sessions.userId, input.userId))
    .returning({ id: sessions.id });
  await logAudit(g.user.id, 'account.sessions-revoked', {
    targetUserId: input.userId,
    detail: `${deleted.length} session(s)`,
  });
  return { ok: true as const, count: deleted.length };
}
