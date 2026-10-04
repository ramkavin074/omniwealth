'use server';

import crypto from 'node:crypto';
import { db } from '@/db';
import { reportLinks } from '@/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { getSessionUserAction } from '@/actions/vault';
import { canManageHousehold, FORBIDDEN_ERROR } from '@/lib/permissions';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { logError } from '@/lib/log';
import { hashReportToken } from '@/lib/reportToken';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || 'https://www.omniwealth.org';
const ALLOWED_DAYS = [1, 7, 30] as const;

export interface ReportLinkRow {
  id: string;
  label: string | null;
  expiresAt: string;
  revokedAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
  status: 'active' | 'expired' | 'revoked';
}

function audit(session: any, action: string, targetId?: string, meta?: Record<string, unknown>) {
  return logAudit({
    actorUserId: session?.user?.id,
    actorEmail: session?.user?.email,
    householdId: session?.household?.id,
    action,
    targetType: 'report_link',
    targetId: targetId ?? null,
    meta,
  });
}

/** Create a read-only report link. The full URL is returned once and never stored. */
export async function createReportLinkAction(
  days: number,
  label?: string,
): Promise<{ success: true; url: string; expiresAt: string } | { success: false; error: string }> {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  // Sharing household wealth data outside the app is an owner/admin decision.
  if (!canManageHousehold(session.user.role)) return { success: false, error: FORBIDDEN_ERROR };
  if (!(ALLOWED_DAYS as readonly number[]).includes(days)) {
    return { success: false, error: 'Choose 1, 7 or 30 days.' };
  }

  const limit = await checkRateLimit(`report-link:${session.user.id}`, 10, 60);
  if (!limit.allowed) {
    return { success: false, error: `Too many links created. Try again in about ${limit.retryAfterMinutes} minute(s).` };
  }

  try {
    const token = crypto.randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + days * 86400000);
    const cleanLabel = (label || '').trim().slice(0, 80) || null;
    const [row] = await db
      .insert(reportLinks)
      .values({
        householdId: session.household.id,
        createdBy: session.user.id,
        tokenHash: hashReportToken(token),
        label: cleanLabel,
        expiresAt,
      })
      .returning({ id: reportLinks.id });
    await audit(session, 'report_link.create', row.id, { days, label: cleanLabel });
    return { success: true, url: `${SITE.replace(/\/$/, '')}/r/${token}`, expiresAt: expiresAt.toISOString() };
  } catch (err) {
    logError('createReportLinkAction', err);
    return { success: false, error: 'Could not create the link. The report-links table may not be set up yet.' };
  }
}

export async function listReportLinksAction(): Promise<ReportLinkRow[]> {
  const session = await getSessionUserAction();
  if (!session || !canManageHousehold(session.user.role)) return [];
  try {
    const rows = await db
      .select()
      .from(reportLinks)
      .where(eq(reportLinks.householdId, session.household.id))
      .orderBy(desc(reportLinks.createdAt))
      .limit(20);
    const now = Date.now();
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      expiresAt: r.expiresAt.toISOString(),
      revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
      viewCount: r.viewCount,
      lastViewedAt: r.lastViewedAt ? r.lastViewedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      status: r.revokedAt ? 'revoked' : r.expiresAt.getTime() <= now ? 'expired' : 'active',
    }));
  } catch {
    return []; // table not created yet
  }
}

export async function revokeReportLinkAction(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!canManageHousehold(session.user.role)) return { success: false, error: FORBIDDEN_ERROR };
  try {
    const res = await db
      .update(reportLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(reportLinks.id, id), eq(reportLinks.householdId, session.household.id)))
      .returning({ id: reportLinks.id });
    if (res.length === 0) return { success: false, error: 'Link not found.' };
    await audit(session, 'report_link.revoke', id);
    return { success: true };
  } catch (err) {
    logError('revokeReportLinkAction', err);
    return { success: false, error: 'Could not revoke the link.' };
  }
}
