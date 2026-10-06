// Turns queued payment-app notifications (from the Android listener) into "money received"
// rows. Pure: reuses the pasted-message parser.

import { parseUpiMessages, type ParsedReceipt } from './upiMessage';

export interface QueuedNotification {
  id: number;
  pkg: string;
  title: string;
  text: string;
  postedAt: number; // epoch ms
}

export interface NotificationReceipt extends ParsedReceipt {
  source: 'notification';
}

/** Receipts found in the notifications. Each keeps its own identity (a synthetic
 *  reference when the text carries none) so two real payments of the same amount in the
 *  same minute are not mistaken for one, while the same notification seen twice is. */
export function receiptsFromNotifications(items: QueuedNotification[]): NotificationReceipt[] {
  const out: NotificationReceipt[] = [];
  for (const it of items) {
    const text = [it.title, it.text].filter(Boolean).join('. ');
    const parsed = parseUpiMessages(text, it.postedAt);
    parsed.receipts.forEach((r, i) => {
      out.push({
        ...r,
        // Notifications carry their own time; the parser falls back to it when the text has none.
        ref: r.ref ?? `ntf:${it.pkg}:${it.postedAt}${i ? ':' + i : ''}`,
        source: 'notification',
      });
    });
  }
  return out;
}
