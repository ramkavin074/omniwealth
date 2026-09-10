// On-device weekly "review your net worth" reminder via @capacitor/local-notifications.
// No server, no APNs. Native-only; every function is a no-op on web.

import { Capacitor } from '@capacitor/core';

export const REMINDER_KEY = 'ow.weeklyReminder.v1';
const NOTIFICATION_ID = 4210;

export function reminderEnabled(): boolean {
  try {
    return Capacitor.isNativePlatform() && localStorage.getItem(REMINDER_KEY) === '1';
  } catch {
    return false;
  }
}

/** Returns the new state (may differ from `want` if permission was denied). */
export async function setWeeklyReminder(want: boolean): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  let LocalNotifications: typeof import('@capacitor/local-notifications').LocalNotifications;
  try {
    ({ LocalNotifications } = await import('@capacitor/local-notifications'));
  } catch {
    return false;
  }

  if (!want) {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
    } catch {
      /* nothing scheduled */
    }
    try {
      localStorage.removeItem(REMINDER_KEY);
    } catch {
      /* ignore */
    }
    return false;
  }

  let perm = await LocalNotifications.checkPermissions();
  if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') {
    perm = await LocalNotifications.requestPermissions();
  }
  if (perm.display !== 'granted') return false;

  // Next Monday at 09:00, then every week.
  const next = new Date();
  next.setHours(9, 0, 0, 0);
  const daysUntilMonday = (8 - next.getDay()) % 7 || 7;
  next.setDate(next.getDate() + daysUntilMonday);

  await LocalNotifications.schedule({
    notifications: [
      {
        id: NOTIFICATION_ID,
        title: 'OmniWealth',
        body: 'Time for your weekly wealth review — see where things stand.',
        schedule: { at: next, every: 'week', allowWhileIdle: true },
      },
    ],
  });

  try {
    localStorage.setItem(REMINDER_KEY, '1');
  } catch {
    /* ignore */
  }
  return true;
}
