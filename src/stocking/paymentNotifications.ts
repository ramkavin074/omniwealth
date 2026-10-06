// Android only: pick up "money received" notifications from UPI apps (PhonePe, Google Pay,
// Paytm, BHIM) through the native listener, record them as receipts and match them to bills.
// The listener must be switched on by the user in Android Settings, Notification access.

import { registerPlugin, Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { receiptsFromNotifications, type QueuedNotification } from '@/lib/paymentNotifications';
import { addReceipts, autoMatch } from './db/upi';

interface PaymentNotificationsPlugin {
  isEnabled(): Promise<{ enabled: boolean }>;
  openSettings(): Promise<void>;
  peek(): Promise<{ items: QueuedNotification[] }>;
  ack(opts: { upToId: number }): Promise<void>;
  addListener(event: 'payment', cb: () => void): Promise<PluginListenerHandle>;
}

const Native = registerPlugin<PaymentNotificationsPlugin>('PaymentNotifications');

/** True only inside the Android app (the feature does not exist on iPhone or the web). */
export function paymentNotificationsSupported(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

export async function paymentNotificationsEnabled(): Promise<boolean> {
  if (!paymentNotificationsSupported()) return false;
  try {
    return (await Native.isEnabled()).enabled;
  } catch {
    return false;
  }
}

export async function openPaymentNotificationSettings(): Promise<void> {
  if (!paymentNotificationsSupported()) return;
  try {
    await Native.openSettings();
  } catch {
    /* settings screen unavailable on this phone */
  }
}

let importing: Promise<number> | null = null;

/** Store whatever the listener has queued. Returns how many new receipts were added. */
export function importPendingPayments(): Promise<number> {
  if (!paymentNotificationsSupported()) return Promise.resolve(0);
  if (!importing) {
    importing = (async () => {
      try {
        const { items } = await Native.peek();
        if (!items?.length) return 0;
        const receipts = receiptsFromNotifications(items);
        let added = 0;
        if (receipts.length) {
          added = await addReceipts(
            receipts.map((r) => ({
              amount: r.amount,
              receivedAt: r.receivedAt,
              ref: r.ref,
              payerName: r.payer,
              source: 'notification' as const,
            })),
          );
          const from = Math.min(...receipts.map((r) => r.receivedAt)) - 1;
          const to = Math.max(...receipts.map((r) => r.receivedAt)) + 1;
          await autoMatch(from, to);
        }
        // Only now is it safe to forget them: they are in the local database.
        await Native.ack({ upToId: Math.max(...items.map((i) => i.id)) });
        return added;
      } catch {
        return 0;
      }
    })().finally(() => {
      importing = null;
    });
  }
  return importing;
}

/** Import now, whenever a payment notification arrives, and when the app comes back to the front. */
export function startPaymentWatcher(onAdded?: (n: number) => void): () => void {
  if (!paymentNotificationsSupported()) return () => {};
  const run = () => {
    void importPendingPayments().then((n) => {
      if (n > 0) onAdded?.(n);
    });
  };
  run();
  const onVisible = () => {
    if (document.visibilityState === 'visible') run();
  };
  document.addEventListener('visibilitychange', onVisible);
  let handle: PluginListenerHandle | null = null;
  let stopped = false;
  Native.addListener('payment', run)
    .then((h) => {
      if (stopped) void h.remove();
      else handle = h;
    })
    .catch(() => {});
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
    void handle?.remove();
  };
}
