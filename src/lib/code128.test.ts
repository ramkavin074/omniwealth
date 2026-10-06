import { describe, expect, it } from 'vitest';
import { canEncode128, code128Modules, code128Svg } from './code128';
import ref from './code128.ref.json';

// The reference strings were produced by the independent python-barcode library
// (Code 128, set B for these inputs), so a typo in the pattern table fails here.
describe('code128', () => {
  // every printable non-digit character (the library switches to set C inside digit runs)
  const ALL = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).filter((c) => !/\d/.test(c)).join('');
  for (const key of ['A', 'Hello 123', 'ab-12/Z', 'a0a1a2a3a4a5a6a7a8a9a', ALL]) {
    it(`matches the reference encoding for "${key.slice(0, 12)}"`, () => {
      expect(code128Modules(key)).toBe((ref as Record<string, string>)[key]);
    });
  }

  it('rejects text outside printable ASCII', () => {
    expect(canEncode128('')).toBe(false);
    expect(canEncode128('தமிழ்')).toBe(false);
    expect(canEncode128('8901234567890')).toBe(true);
    expect(() => code128Modules('é')).toThrow();
  });

  it('every symbol is 11 modules wide (stop is 13)', () => {
    const m = code128Modules('8901234567890');
    const symbols = 1 + 13 + 1; // start + data + check
    expect(m.length).toBe(symbols * 11 + 13);
  });

  it('draws an svg', () => {
    expect(code128Svg('A')).toContain('<rect');
  });
});
