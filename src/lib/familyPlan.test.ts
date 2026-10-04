import { describe, expect, it } from 'vitest';
import { daysUntil, dueLabel, dueState, isIsoDate, nextYear, sanitizeContact, sanitizeEvent, sanitizeReminder } from './familyPlan';

const NOW = Date.parse('2026-10-04T12:00:00Z');

describe('familyPlan', () => {
  it('validates ISO dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('10/04/2026')).toBe(false);
    expect(isIsoDate(5)).toBe(false);
  });

  it('sanitises reminders', () => {
    expect(sanitizeReminder({ title: ' ', dueDate: '2026-12-01' }).ok).toBe(false);
    expect(sanitizeReminder({ title: 'PPF', dueDate: 'nope' }).ok).toBe(false);
    const r = sanitizeReminder({ title: 'Car insurance', kind: 'hacker', dueDate: '2026-12-01', repeatYearly: true, note: '' });
    expect(r.ok && r.value).toMatchObject({ kind: 'other', repeatYearly: true, note: null });
  });

  it('requires a way to reach a contact and flags the legacy contact', () => {
    expect(sanitizeContact({ name: 'A' }).ok).toBe(false);
    expect(sanitizeContact({ name: 'A', email: 'bad' }).ok).toBe(false);
    const c = sanitizeContact({ name: 'Priya', role: 'Legacy contact', phone: '+1 555 0100' });
    expect(c.ok && c.value.isLegacy).toBe(true);
  });

  it('sanitises events', () => {
    expect(sanitizeEvent({ label: 'Bought house', eventDate: '2025-06-01' }).ok).toBe(true);
    expect(sanitizeEvent({ label: '', eventDate: '2025-06-01' }).ok).toBe(false);
  });

  it('computes due states and labels', () => {
    expect(daysUntil('2026-10-14', NOW)).toBe(10);
    expect(dueState('2026-10-01', NOW)).toBe('overdue');
    expect(dueState('2026-12-01', NOW)).toBe('soon');
    expect(dueState('2027-06-01', NOW)).toBe('upcoming');
    expect(dueLabel('2026-10-04', NOW)).toBe('Due today');
    expect(dueLabel('2026-10-14', NOW)).toBe('In 10 days');
    expect(dueLabel('2026-10-01', NOW)).toBe('Overdue by 3 days');
  });

  it('rolls yearly reminders forward', () => {
    expect(nextYear('2026-10-04')).toBe('2027-10-04');
    expect(nextYear('2028-02-29')).toBe('2029-02-28');
  });
});
