// Pure validation / status helpers for reminders, contacts and timeline events.

export const REMINDER_KINDS = ['renewal', 'maturity', 'expiry', 'review', 'other'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export const CONTACT_ROLES = [
  'Legacy contact',
  'Executor',
  'Lawyer',
  'Accountant',
  'Financial advisor',
  'Insurance agent',
  'Family doctor',
  'Other',
] as const;

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

/** True for a real calendar date written YYYY-MM-DD. */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface ReminderInput {
  title: string;
  kind: ReminderKind;
  dueDate: string;
  repeatYearly: boolean;
  note: string | null;
}

export function sanitizeReminder(raw: Record<string, unknown>): Result<ReminderInput> {
  const title = clip(raw.title, 120);
  if (!title) return { ok: false, error: 'Give the reminder a title.' };
  if (!isIsoDate(raw.dueDate)) return { ok: false, error: 'Choose a valid date.' };
  const kind = (REMINDER_KINDS as readonly string[]).includes(raw.kind as string) ? (raw.kind as ReminderKind) : 'other';
  return {
    ok: true,
    value: { title, kind, dueDate: raw.dueDate, repeatYearly: raw.repeatYearly === true, note: clip(raw.note, 300) || null },
  };
}

export interface ContactInput {
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  note: string | null;
  isLegacy: boolean;
}

export function sanitizeContact(raw: Record<string, unknown>): Result<ContactInput> {
  const name = clip(raw.name, 80);
  if (!name) return { ok: false, error: 'Enter a name.' };
  const phone = clip(raw.phone, 40) || null;
  const email = clip(raw.email, 120) || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'That email address does not look right.' };
  if (!phone && !email) return { ok: false, error: 'Add a phone number or an email so the family can reach them.' };
  const role = clip(raw.role, 40) || 'Other';
  return {
    ok: true,
    value: { name, role, phone, email, note: clip(raw.note, 200) || null, isLegacy: role === 'Legacy contact' },
  };
}

export function sanitizeEvent(raw: Record<string, unknown>): Result<{ label: string; eventDate: string }> {
  const label = clip(raw.label, 80);
  if (!label) return { ok: false, error: 'Describe the event.' };
  if (!isIsoDate(raw.eventDate)) return { ok: false, error: 'Choose a valid date.' };
  return { ok: true, value: { label, eventDate: raw.eventDate } };
}

export type DueState = 'overdue' | 'soon' | 'upcoming';

/** Whole days from today (UTC date) to the due date; negative once past. */
export function daysUntil(dueDate: string, now = Date.now()): number {
  const today = Date.parse(new Date(now).toISOString().slice(0, 10));
  return Math.round((Date.parse(dueDate) - today) / 86400000);
}

export function dueState(dueDate: string, now = Date.now(), soonDays = 90): DueState {
  const d = daysUntil(dueDate, now);
  return d < 0 ? 'overdue' : d <= soonDays ? 'soon' : 'upcoming';
}

export function dueLabel(dueDate: string, now = Date.now()): string {
  const d = daysUntil(dueDate, now);
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  if (d > 1) return d < 60 ? `In ${d} days` : `In ${Math.round(d / 30)} months`;
  const a = Math.abs(d);
  return a === 1 ? 'Overdue by 1 day' : a < 60 ? `Overdue by ${a} days` : `Overdue by ${Math.round(a / 30)} months`;
}

/** Same calendar day next year (Feb 29 rolls to Feb 28). */
export function nextYear(dueDate: string): string {
  const [y, m, d] = dueDate.split('-').map(Number);
  const ny = y + 1;
  const last = new Date(Date.UTC(ny, m, 0)).getUTCDate();
  return `${ny}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
