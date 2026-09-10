'use server';

import { db } from '@/db';
import { pushTokens } from '@/db/schema';
import { getSessionUserAction } from './auth';
import { and, eq } from 'drizzle-orm';

type Platform = 'ios' | 'android' | 'web';

/**
 * Store (or refresh) an APNs/FCM device token for the signed-in user.
 * Idempotent on the token value.
 */
export async function registerPushTokenAction(token: string, platform: Platform) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!token || typeof token !== 'string' || token.length > 500) {
    return { success: false, error: 'Invalid token' };
  }

  try {
    await db
      .insert(pushTokens)
      .values({ userId: session.user.id, platform, token })
      .onConflictDoUpdate({
        target: pushTokens.token,
        set: { userId: session.user.id, platform, updatedAt: new Date() },
      });
    return { success: true };
  } catch (e) {
    // Table may not exist yet in an environment where the migration hasn't
    // run — fail soft so the app keeps working.
    console.warn('registerPushTokenAction failed', e);
    return { success: false, error: 'Could not register token' };
  }
}

/** Drop a token (sign-out, permission revoked, or provider reported it stale). */
export async function unregisterPushTokenAction(token: string) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  try {
    await db
      .delete(pushTokens)
      .where(and(eq(pushTokens.token, token), eq(pushTokens.userId, session.user.id)));
    return { success: true };
  } catch (e) {
    console.warn('unregisterPushTokenAction failed', e);
    return { success: false, error: 'Could not unregister token' };
  }
}
