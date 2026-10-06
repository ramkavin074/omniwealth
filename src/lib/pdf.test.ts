import { describe, expect, it } from 'vitest';
import { buildPdf } from './pdf';

const page = (n: number) => ({
  widthPt: 595.28,
  heightPt: 841.89,
  jpeg: new Uint8Array([0xff, 0xd8, n, 0xff, 0xd9]),
  widthPx: 10,
  heightPx: 20,
});

describe('buildPdf', () => {
  it('writes a well-formed document', () => {
    const bytes = buildPdf([page(1), page(2)]);
    const s = new TextDecoder('latin1').decode(bytes);
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(s).toContain('/Count 2');
    expect(s.match(/\/Subtype \/Image/g)).toHaveLength(2);
  });

  it('points every xref entry at its object', () => {
    const bytes = buildPdf([page(1), page(2), page(3)]);
    const s = new TextDecoder('latin1').decode(bytes);
    const xrefAt = Number(/startxref\n(\d+)/.exec(s)![1]);
    expect(s.slice(xrefAt, xrefAt + 4)).toBe('xref');
    const entries = s.slice(xrefAt).split('\n').filter((l) => /^\d{10} 00000 n/.test(l));
    expect(entries).toHaveLength(3 + 3 * 3 - 1);
    entries.forEach((e, i) => {
      const off = Number(e.slice(0, 10));
      expect(s.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
  });

  it('stores the image bytes exactly and with the right length', () => {
    const bytes = buildPdf([page(7)]);
    const s = new TextDecoder('latin1').decode(bytes);
    expect(s).toContain('/Length 5 >>');
    expect(Array.from(bytes).join(',')).toContain('255,216,7,255,217');
  });

  it('rejects an empty document', () => {
    expect(() => buildPdf([])).toThrow();
  });
});
