import { describe, expect, it } from 'vitest';
import { receiptsFromNotifications } from './paymentNotifications';

const at = new Date(2026, 9, 5, 14, 30, 0).getTime();
const n = (id: number, title: string, text: string, pkg = 'com.phonepe.app') => ({
  id,
  pkg,
  title,
  text,
  postedAt: at + id * 1000,
});

describe('receiptsFromNotifications', () => {
  it('reads PhonePe / GPay / Paytm style notifications', () => {
    const r = receiptsFromNotifications([
      n(1, 'Payment received', '₹250 received from Ravi Kumar'),
      n(2, 'Ravi Kumar', 'paid you ₹80', 'com.google.android.apps.nbu.paisa.user'),
      n(3, 'Paytm', 'Received ₹1,200 from Selvi', 'net.one97.paytm'),
    ]);
    expect(r.map((x) => x.amount)).toEqual([250, 80, 1200]);
    expect(r[0].payer).toBe('Ravi Kumar');
    expect(r.every((x) => x.source === 'notification')).toBe(true);
  });

  it('ignores money going out and offers', () => {
    const r = receiptsFromNotifications([
      n(1, 'Payment successful', 'You paid ₹120 to Raja Stores'),
      n(2, 'Cashback', 'Win up to ₹500 cashback on your next recharge'),
    ]);
    expect(r).toHaveLength(0);
  });

  it('uses the notification time and a synthetic reference', () => {
    const [r] = receiptsFromNotifications([n(5, 'Payment received', '₹99 received from A')]);
    expect(r.receivedAt).toBe(at + 5000);
    expect(r.ref).toBe(`ntf:com.phonepe.app:${at + 5000}`);
  });

  it('keeps a real transaction reference when the text has one', () => {
    const [r] = receiptsFromNotifications([
      n(1, 'Payment received', '₹250 received from Ravi. UPI Ref 628812345678'),
    ]);
    expect(r.ref).toBe('628812345678');
  });

  it('gives two same-amount payments in one minute different identities', () => {
    const r = receiptsFromNotifications([
      n(1, 'Payment received', '₹50 received from A'),
      n(2, 'Payment received', '₹50 received from A'),
    ]);
    expect(new Set(r.map((x) => x.ref)).size).toBe(2);
  });
});
