import { describe, expect, it } from 'vitest';
import { generateWidgetKey, hashWidgetKey, looksLikeWidgetKey, parseBearer } from './widgetKey';

describe('widget keys', () => {
  it('generates unique, well-formed keys and stores only a different hash', () => {
    const a = generateWidgetKey();
    const b = generateWidgetKey();
    expect(a).not.toBe(b);
    expect(looksLikeWidgetKey(a)).toBe(true);
    expect(hashWidgetKey(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashWidgetKey(a)).not.toContain(a);
    expect(hashWidgetKey(a)).toBe(hashWidgetKey(a));
  });
  it('rejects malformed keys', () => {
    for (const bad of ['', 'owk_short', 'abc', null, undefined, 'owk_' + 'x'.repeat(44), 'owk_' + '!'.repeat(43)]) {
      expect(looksLikeWidgetKey(bad as string)).toBe(false);
    }
  });
  it('parses bearer headers', () => {
    expect(parseBearer('Bearer abc123')).toBe('abc123');
    expect(parseBearer('bearer abc123')).toBe('abc123');
    expect(parseBearer('Basic abc')).toBeNull();
    expect(parseBearer(null)).toBeNull();
  });
});
