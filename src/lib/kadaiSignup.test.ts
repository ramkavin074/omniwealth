import { describe, expect, it } from 'vitest';
import { checkTicket, cleanName, CODE_TTL_MS, EMAIL_RE, makeTicket, newCode, passwordProblem } from './kadaiSignup';

const KEY = 'test-key-123';
const NOW = 1_800_000_000_000;

describe('kadai signup helpers', () => {
  it('enforces the password rules', () => {
    expect(passwordProblem('short1!A')).toBeNull();
    expect(passwordProblem('Sh0rt!')).toMatch(/at least 8/);
    expect(passwordProblem('alllower1!')).toMatch(/uppercase/);
    expect(passwordProblem('ALLUPPER1!')).toMatch(/lowercase/);
    expect(passwordProblem('NoNumber!!')).toMatch(/number/);
    expect(passwordProblem('NoSymbol11')).toMatch(/symbol/);
    expect(passwordProblem('Aa1!' + 'x'.repeat(130))).toMatch(/128/);
  });

  it('makes six-digit codes', () => {
    for (let i = 0; i < 50; i++) expect(newCode()).toMatch(/^\d{6}$/);
  });

  it('accepts the right code for the right email', () => {
    const t = makeTicket('a@b.in', '123456', KEY, NOW);
    expect(checkTicket(t, 'a@b.in', '123456', KEY, NOW + 1000)).toBe('ok');
    expect(checkTicket(t, 'a@b.in', ' 123456 ', KEY, NOW + 1000)).toBe('ok');
  });

  it('rejects a wrong code, another email, another key or a mangled ticket', () => {
    const t = makeTicket('a@b.in', '123456', KEY, NOW);
    expect(checkTicket(t, 'a@b.in', '654321', KEY, NOW)).toBe('bad');
    expect(checkTicket(t, 'x@b.in', '123456', KEY, NOW)).toBe('bad');
    expect(checkTicket(t, 'a@b.in', '123456', 'other', NOW)).toBe('bad');
    expect(checkTicket('garbage', 'a@b.in', '123456', KEY, NOW)).toBe('bad');
    expect(checkTicket(t.replace(/.$/, '0'), 'a@b.in', '123456', KEY, NOW)).toBe('bad');
  });

  it('expires after 15 minutes', () => {
    const t = makeTicket('a@b.in', '123456', KEY, NOW);
    expect(checkTicket(t, 'a@b.in', '123456', KEY, NOW + CODE_TTL_MS - 1)).toBe('ok');
    expect(checkTicket(t, 'a@b.in', '123456', KEY, NOW + CODE_TTL_MS + 1)).toBe('expired');
  });

  it('cleans names and validates emails', () => {
    expect(cleanName('  Sri   Murugan   Stores ')).toBe('Sri Murugan Stores');
    expect(cleanName('x'.repeat(100)).length).toBe(60);
    expect(EMAIL_RE.test('a@b.in')).toBe(true);
    expect(EMAIL_RE.test('nope')).toBe(false);
  });
});
