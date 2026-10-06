import { describe, expect, it } from 'vitest';
import { padPress, padStart, type PadState } from './numpadInput';

const type = (init: number, keys: string) =>
  [...keys].reduce<PadState>((s, k) => padPress(s, k), padStart(init)).str;

describe('numpad input', () => {
  it('typing over an existing value replaces it (50 then 55 gives 55)', () => {
    expect(type(50, '55')).toBe('55');
    expect(type(2.5, '7')).toBe('7');
  });
  it('starts empty from zero', () => {
    expect(type(0, '55')).toBe('55');
  });
  it('a decimal point on an untouched value starts a new number', () => {
    expect(type(50, '.5')).toBe('0.5');
  });
  it('backspace edits the existing value instead of replacing it', () => {
    expect(type(50, '⌫')).toBe('5');
    expect(type(50, '⌫7')).toBe('57');
    expect(type(55, '⌫⌫')).toBe('');
  });
  it('builds decimals and avoids leading zeros', () => {
    expect(type(0, '0.25')).toBe('0.25');
    expect(type(0, '007')).toBe('7');
    expect(type(0, '1.2.3')).toBe('1.23');
  });
  it('keeps the sign out of the digits', () => {
    expect(padStart(-5).str).toBe('5');
  });
});
