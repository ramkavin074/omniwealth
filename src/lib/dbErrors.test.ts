import { describe, expect, it } from 'vitest';
import { pgCode, safeMessage } from './dbErrors';

// Drizzle wraps the driver error: message "Failed query: <sql> params: <values>"
// with the original Postgres error on `.cause`.
const wrapped = (code: string) =>
  Object.assign(new Error('Failed query: insert into "users" (...) params: a,b,$2b$12$hash'), {
    cause: Object.assign(new Error('duplicate key value violates unique constraint'), { code }),
  });

describe('pgCode', () => {
  it('finds the code on the error itself or on its cause chain', () => {
    expect(pgCode(Object.assign(new Error('x'), { code: '23505' }))).toBe('23505');
    expect(pgCode(wrapped('23505'))).toBe('23505');
  });
  it('ignores non-Postgres codes and plain errors', () => {
    expect(pgCode(Object.assign(new Error('x'), { code: 'ECONNRESET' }))).toBeUndefined();
    expect(pgCode(new Error('plain'))).toBeUndefined();
    expect(pgCode('nope')).toBeUndefined();
    expect(pgCode(null)).toBeUndefined();
  });
});

describe('safeMessage', () => {
  it('never shows SQL, parameters or password hashes', () => {
    const msg = safeMessage(wrapped('23505'), 'Please try again.');
    expect(msg).toBe('Please try again.');
    expect(safeMessage(new Error('Failed query: select ... params: 1,2'), 'Fallback')).toBe('Fallback');
  });
  it('passes through messages we threw on purpose, and falls back for non-errors', () => {
    expect(safeMessage(new Error('This invitation link is invalid or has expired.'), 'Fallback')).toBe(
      'This invitation link is invalid or has expired.',
    );
    expect(safeMessage('weird', 'Fallback')).toBe('Fallback');
  });
});
