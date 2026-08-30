import { db } from '@/db';
import { auditLog } from '@/db/schema';
import { logError } from '@/lib/log';

/**
 * Append an audit-trail entry. Best-effort: never throws, so it can't
 * break the mutation it's recording (including before the table exists).
 */
export async function logAudit(entry: {
  householdId?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType?: string;
  targetId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(auditLog).values({
      householdId: entry.householdId ?? null,
      actorUserId: entry.actorUserId ?? null,
      actorEmail: entry.actorEmail ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      meta: entry.meta ? JSON.stringify(entry.meta) : null,
    });
  } catch (e) {
    logError('logAudit', e, { action: entry.action });
  }
}
