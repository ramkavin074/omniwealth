// Adoption numbers for the operator console. Counts and dates only — never
// amounts, holding names or anything about what a person owns.

export interface PersonActivity {
  accountCreated: string | null;
  lastLogin: string | null;
  holdings: number;
  lastActivity: string | null;
  isStoreShell: boolean;
  stores: unknown[];
}

export type PersonStatus = 'never-signed-in' | 'no-data' | 'active' | 'quiet' | 'store-only';

const DAY = 864e5;
const ms = (iso: string | null) => (iso ? Date.parse(iso) || 0 : 0);

/** The most recent sign of life: a login or any data activity. */
export function lastSeen(p: Pick<PersonActivity, 'lastLogin' | 'lastActivity'>): number {
  return Math.max(ms(p.lastLogin), ms(p.lastActivity));
}

export function personStatus(p: PersonActivity, now: number, quietDays = 30): PersonStatus {
  if (p.isStoreShell) return 'store-only';
  if (p.holdings === 0 && lastSeen(p) === 0) return 'never-signed-in';
  if (p.holdings === 0) return 'no-data';
  return now - lastSeen(p) > quietDays * DAY ? 'quiet' : 'active';
}

export interface AdoptionSummary {
  total: number;
  new7: number;
  new30: number;
  active7: number;
  active30: number;
  withData: number;
  noData: number;
  neverSignedIn: number;
}

/** Wealth-app adoption; store-only (Kadai) accounts are counted separately. */
export function summarize(people: PersonActivity[], now: number): AdoptionSummary {
  const wealth = people.filter((p) => !p.isStoreShell);
  const within = (t: number, days: number) => t > 0 && now - t <= days * DAY;
  return {
    total: wealth.length,
    new7: wealth.filter((p) => within(ms(p.accountCreated), 7)).length,
    new30: wealth.filter((p) => within(ms(p.accountCreated), 30)).length,
    active7: wealth.filter((p) => within(lastSeen(p), 7)).length,
    active30: wealth.filter((p) => within(lastSeen(p), 30)).length,
    withData: wealth.filter((p) => p.holdings > 0).length,
    noData: wealth.filter((p) => personStatus(p, now) === 'no-data').length,
    neverSignedIn: wealth.filter((p) => personStatus(p, now) === 'never-signed-in').length,
  };
}
