'use server';

import { db } from '@/db';
import { notificationPrefs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionUserAction } from '@/actions/vault';
import { logError } from '@/lib/log';

/** Defaults to ON when there's no row (or the table isn't created yet). */
export async function getNetWorthAlertsAction(): Promise<boolean> {
  const session = await getSessionUserAction();
  if (!session) return true;
  try {
    const [row] = await db
      .select({ on: notificationPrefs.netWorthAlerts })
      .from(notificationPrefs)
      .where(eq(notificationPrefs.userId, session.user.id));
    return row ? row.on : true;
  } catch {
    return true;
  }
}

export async function setNetWorthAlertsAction(enabled: boolean): Promise<{ success: boolean; error?: string }> {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  try {
    await db
      .insert(notificationPrefs)
      .values({ userId: session.user.id, netWorthAlerts: !!enabled })
      .onConflictDoUpdate({
        target: notificationPrefs.userId,
        set: { netWorthAlerts: !!enabled, updatedAt: new Date() },
      });
    return { success: true };
  } catch (err) {
    logError('setNetWorthAlertsAction', err);
    return { success: false, error: 'Could not save. The preferences table may not be set up yet.' };
  }
}
