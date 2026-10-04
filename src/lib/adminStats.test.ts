import { describe, expect, it } from 'vitest';
import { lastSeen, personStatus, summarize, type PersonActivity } from './adminStats';

const NOW = Date.parse('2026-10-04T12:00:00Z');
const day = (n: number) => new Date(NOW - n * 864e5).toISOString();
const p = (o: Partial<PersonActivity> = {}): PersonActivity => ({
  accountCreated: day(100), lastLogin: null, holdings: 0, lastActivity: null, isStoreShell: false, stores: [], ...o,
});

describe('adminStats', () => {
  it('classifies people', () => {
    expect(personStatus(p(), NOW)).toBe('never-signed-in');
    expect(personStatus(p({ lastLogin: day(2) }), NOW)).toBe('no-data');
    expect(personStatus(p({ holdings: 5, lastActivity: day(3) }), NOW)).toBe('active');
    expect(personStatus(p({ holdings: 5, lastActivity: day(90), lastLogin: day(80) }), NOW)).toBe('quiet');
    expect(personStatus(p({ isStoreShell: true }), NOW)).toBe('store-only');
  });

  it('uses the later of login and activity', () => {
    expect(lastSeen(p({ lastLogin: day(10), lastActivity: day(2) }))).toBe(Date.parse(day(2)));
    expect(lastSeen(p())).toBe(0);
  });

  it('summarises adoption and ignores store-only accounts', () => {
    const s = summarize(
      [
        p({ accountCreated: day(2), lastLogin: day(1), holdings: 3 }),
        p({ accountCreated: day(20), lastLogin: day(15) }),
        p({ accountCreated: day(50) }),
        p({ isStoreShell: true, accountCreated: day(1), holdings: 9 }),
      ],
      NOW,
    );
    expect(s).toEqual({ total: 3, new7: 1, new30: 2, active7: 1, active30: 2, withData: 1, noData: 1, neverSignedIn: 1 });
  });
});
