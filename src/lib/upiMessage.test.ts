import { describe, expect, it } from 'vitest';
import { parseUpiMessages, splitMessages } from './upiMessage';

// 5 Oct 2026, 14:30 local
const NOW = new Date(2026, 9, 5, 14, 30, 0).getTime();
const at = (d: number, mo: number, h: number, m: number, y = 2026) =>
  new Date(y, mo - 1, d, h, m, 0).getTime();

describe('parseUpiMessages', () => {
  it('reads a bank credit SMS with date, ref and payer', () => {
    const r = parseUpiMessages(
      'Rs 250.00 credited to A/c XX1234 on 05-10-26 by UPI/P2A/628812345678/RAVI KUMAR. Avl Bal Rs 12,000.50',
      NOW,
    );
    expect(r.receipts).toHaveLength(1);
    expect(r.receipts[0]).toMatchObject({
      amount: 250,
      ref: '628812345678',
      payer: 'RAVI KUMAR',
    });
  });

  it('reads a PhonePe style notification', () => {
    const r = parseUpiMessages('Received ₹1,250 from Meena Stores', NOW);
    expect(r.receipts[0]).toMatchObject({ amount: 1250, payer: 'Meena Stores' });
    expect(r.receipts[0].receivedAt).toBe(NOW);
  });

  it('reads "X paid you" with a clock time', () => {
    const r = parseUpiMessages('Arun paid you ₹80 at 11:05 AM', NOW);
    expect(r.receipts[0]).toMatchObject({ amount: 80, payer: 'Arun' });
    expect(r.receipts[0].receivedAt).toBe(at(5, 10, 11, 5));
  });

  it('treats a later clock time with no date as yesterday', () => {
    const r = parseUpiMessages('Arun paid you ₹80 at 11:05 PM', NOW);
    expect(r.receipts[0].receivedAt).toBe(at(4, 10, 23, 5));
  });

  it('parses dates written with month names', () => {
    const r = parseUpiMessages(
      'Rs.500 credited to your account on 03 Oct 2026 14:10 UPI Ref No 112233445566',
      NOW,
    );
    expect(r.receipts[0].receivedAt).toBe(at(3, 10, 14, 10));
    expect(r.receipts[0].ref).toBe('112233445566');
  });

  it('ignores money that went out', () => {
    const r = parseUpiMessages(
      'Rs 300.00 debited from A/c XX1234 on 05-10-26 trf to SUPPLIER. UPI Ref 998877665544',
      NOW,
    );
    expect(r.receipts).toHaveLength(0);
    expect(r.skipped).toBe(1);
  });

  it('ignores "you paid" and failed payments', () => {
    expect(parseUpiMessages('You paid ₹120 to Raja', NOW).receipts).toHaveLength(0);
    expect(parseUpiMessages('Payment of ₹120 failed', NOW).receipts).toHaveLength(0);
  });

  it('splits several messages separated by blank lines or pasted back to back', () => {
    const blank = parseUpiMessages(
      'Received ₹100 from A\n\nReceived ₹200 from B\n\nYou paid ₹50 to C',
      NOW,
    );
    expect(blank.receipts.map((x) => x.amount)).toEqual([100, 200]);
    expect(blank.skipped).toBe(1);

    const tight = parseUpiMessages('Received ₹100 from A\nReceived ₹200 from B', NOW);
    expect(tight.receipts.map((x) => x.amount)).toEqual([100, 200]);
  });

  it('keeps a wrapped single message together', () => {
    expect(splitMessages('Payment received\n₹250 from Ravi\nUPI Ref 123456789012')).toHaveLength(1);
  });

  it('reads Tamil rupee and credit words', () => {
    const r = parseUpiMessages('ரூ 450 வரவு from Selvi', NOW);
    expect(r.receipts[0]).toMatchObject({ amount: 450, payer: 'Selvi' });
  });

  it('ignores lines with no amount', () => {
    const r = parseUpiMessages('hello there\nthanks', NOW);
    expect(r).toEqual({ receipts: [], skipped: 0 });
  });

  it('reads common Indian bank credit SMS formats', () => {
    const cases: [string, string | null][] = [
      ['Rs. 250.00 credited to a/c **1234 on 05-10-26 by a/c linked to VPA ravi@okaxis (UPI Ref No 628812345678).', 'ravi@okaxis'],
      ['Your a/c no. XXXXX1234 is credited by Rs.250.00 on 05Oct26 by transfer from RAVI KUMAR with UTR 628812345678 -SBI', 'RAVI KUMAR'],
      ['ICICI Bank Acct XX123 credited with Rs. 250.00 on 05-Oct-26 from RAVI KUMAR. UPI:628812345678', 'RAVI KUMAR'],
      ['Received Rs.250.00 in your Kotak Bank AC X1234 from ravi@okaxis on 05-10-26.UPI Ref:628812345678.', 'ravi@okaxis'],
      ['Rs.250.00 credited to A/c XX1234 on 05/10/26 by UPI/CR/628812345678/RAVI KUMAR', 'RAVI KUMAR'],
      ['INR 250.00 credited to A/c no. XX1234 on 05-10-2026 at 14:21:05 IST. Info- UPI/P2A/628812345678/RAVI KUMAR. Axis Bank', 'RAVI KUMAR'],
    ];
    for (const [sms, payer] of cases) {
      const r = parseUpiMessages(sms, NOW);
      expect(r.receipts, sms).toHaveLength(1);
      expect(r.receipts[0].amount).toBe(250);
      expect(r.receipts[0].ref).toBe('628812345678');
      expect(r.receipts[0].payer, sms).toBe(payer);
    }
    expect(parseUpiMessages('Rs 300.00 debited from A/c XX1234 on 05-10-26 to VPA raja@ybl (UPI Ref No 628812345679)', NOW).receipts).toHaveLength(0);
  });
});
