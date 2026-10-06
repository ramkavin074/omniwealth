import { describe, expect, it } from 'vitest';
import { clampSmsText, hashToken, newIngestToken, smsRef, MAX_SMS_CHARS } from './smsIngest';

describe('smsIngest helpers', () => {
  it('makes long unguessable tokens and hashes them stably', () => {
    const a = newIngestToken();
    const b = newIngestToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(30);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).toHaveLength(64);
    expect(hashToken(a)).not.toBe(a);
  });

  it('gives the same SMS in the same minute the same reference', () => {
    const t = Date.UTC(2026, 9, 5, 10, 0, 5);
    expect(smsRef('Rs 50 credited', t)).toBe(smsRef('Rs 50 credited ', t + 20_000));
  });

  it('gives different messages or minutes different references', () => {
    const t = Date.UTC(2026, 9, 5, 10, 0, 5);
    expect(smsRef('Rs 50 credited', t)).not.toBe(smsRef('Rs 60 credited', t));
    expect(smsRef('Rs 50 credited', t)).not.toBe(smsRef('Rs 50 credited', t + 120_000));
  });

  it('clamps very long text', () => {
    expect(clampSmsText('a'.repeat(MAX_SMS_CHARS + 50))).toHaveLength(MAX_SMS_CHARS);
  });
});
