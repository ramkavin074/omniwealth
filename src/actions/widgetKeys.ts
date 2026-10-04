'use server';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { widgetKeys } from '@/db/schema';
import { and, asc, eq, gt, isNull } from 'drizzle-orm';
import { getSessionUserAction } from '@/actions/vault';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { logError } from '@/lib/log';
import {
  MAX_ACTIVE_WIDGET_KEYS_PER_USER,
  WIDGET_KEY_TTL_DAYS,
  generateWidgetKey,
  hashWidgetKey,
} from '@/lib/widgetKey';

const SESSION_COOKIE_NAME = 'vault_session';

/**
 * Create a read-only key for this phone's Home Screen widget. The key is
 * returned once and never stored in readable form. A phone gets one key per
 * web session: asking again replaces the previous one.
 */
export async function createWidgetKeyAction(
  label?: string,
): Promise<{ success: true; key: string } | { success: false; error: string }> {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  // Store-only (Kadai) accounts have no net worth to show.
  if (session.household?.isStoreShell) return { success: false, error: 'Not available for this account.' };

  const limit = await checkRateLimit(`widget-key:${session.user.id}`, 10, 60);
  if (!limit.allowed) return { success: false, error: 'Too many requests. Try again later.' };

  try {
    const rawToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    const sessionTokenHash = rawToken ? crypto.createHash('sha256').update(rawToken).digest('hex') : null;
    const now = new Date();

    // Replace this session's previous key, and cap the number of live keys.
    if (sessionTokenHash) {
      await db
        .update(widgetKeys)
        .set({ revokedAt: now })
        .where(and(eq(widgetKeys.userId, session.user.id), eq(widgetKeys.sessionTokenHash, sessionTokenHash), isNull(widgetKeys.revokedAt)));
    }
    const live = await db
      .select({ id: widgetKeys.id })
      .from(widgetKeys)
      .where(and(eq(widgetKeys.userId, session.user.id), isNull(widgetKeys.revokedAt), gt(widgetKeys.expiresAt, now)))
      .orderBy(asc(widgetKeys.createdAt));
    const overflow = live.length - (MAX_ACTIVE_WIDGET_KEYS_PER_USER - 1);
    for (const old of live.slice(0, Math.max(0, overflow))) {
      await db.update(widgetKeys).set({ revokedAt: now }).where(eq(widgetKeys.id, old.id));
    }

    const key = generateWidgetKey();
    await db.insert(widgetKeys).values({
      userId: session.user.id,
      householdId: session.household.id,
      keyHash: hashWidgetKey(key),
      sessionTokenHash,
      label: (label || '').trim().slice(0, 60) || null,
      expiresAt: new Date(now.getTime() + WIDGET_KEY_TTL_DAYS * 86400000),
    });
    return { success: true, key };
  } catch (err) {
    logError('createWidgetKeyAction', err);
    // e.g. table not created yet: the widget simply keeps working on app-open updates
    return { success: false, error: 'Could not enable background refresh.' };
  }
}

/** How many phones currently have background refresh switched on for this user. */
export async function countWidgetKeysAction(): Promise<number> {
  const session = await getSessionUserAction();
  if (!session) return 0;
  try {
    const rows = await db
      .select({ id: widgetKeys.id })
      .from(widgetKeys)
      .where(and(eq(widgetKeys.userId, session.user.id), isNull(widgetKeys.revokedAt), gt(widgetKeys.expiresAt, new Date())));
    return rows.length;
  } catch {
    return 0;
  }
}

/** Switch off background refresh on every phone for this user. */
export async function revokeAllWidgetKeysAction(): Promise<{ success: boolean }> {
  const session = await getSessionUserAction();
  if (!session) return { success: false };
  try {
    await db
      .update(widgetKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(widgetKeys.userId, session.user.id), isNull(widgetKeys.revokedAt)));
    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email,
      householdId: session.household.id,
      action: 'widget_keys.revoke_all',
      targetType: 'widget_key',
    });
    return { success: true };
  } catch (err) {
    logError('revokeAllWidgetKeysAction', err);
    return { success: false };
  }
}
