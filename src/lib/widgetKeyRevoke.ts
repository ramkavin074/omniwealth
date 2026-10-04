import { db } from '@/db';
import { widgetKeys } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

// Never throw: a failure here (e.g. table not created yet) must not block
// signing out or changing a password.

/** Switch off the keys created by one web session (called on sign-out). */
export async function revokeWidgetKeysForSession(sessionTokenHash: string): Promise<void> {
  try {
    await db
      .update(widgetKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(widgetKeys.sessionTokenHash, sessionTokenHash), isNull(widgetKeys.revokedAt)));
  } catch {
    /* table not created yet */
  }
}

/** Switch off every key for a user (called when their password changes). */
export async function revokeWidgetKeysForUser(userId: string): Promise<void> {
  try {
    await db
      .update(widgetKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(widgetKeys.userId, userId), isNull(widgetKeys.revokedAt)));
  } catch {
    /* table not created yet */
  }
}
