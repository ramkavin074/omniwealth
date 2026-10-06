import { describe, expect, it } from 'vitest';
import { labelsHtml, newInternalCode } from './labels';

const item = { name: 'Colgate 100g', barcode: '8901314010100', rate: 55, mrp: 60, copies: 3 };

describe('labelsHtml', () => {
  it('repeats a label per copy with name, price and a barcode', () => {
    const h = labelsHtml([item], { layout: 'a4', price: 'rate' });
    expect(h.match(/class="lb"/g)).toHaveLength(3);
    expect(h).toContain('Colgate 100g');
    expect(h).toContain('₹55');
    expect(h).toContain('<svg');
  });
  it('can show the MRP or no price', () => {
    expect(labelsHtml([item], { layout: 'roll', price: 'mrp' })).toContain('₹60');
    expect(labelsHtml([item], { layout: 'roll', price: 'none' })).not.toContain('class="pr"');
  });
  it('escapes product names', () => {
    const h = labelsHtml([{ ...item, name: '<b>Tea</b> & Co', copies: 1 }], { layout: 'a4', price: 'rate' });
    expect(h).not.toContain('<b>Tea');
    expect(h).toContain('&lt;b&gt;Tea');
  });
  it('caps runaway copy counts', () => {
    const h = labelsHtml([{ ...item, copies: 100000 }], { layout: 'a4', price: 'rate' });
    expect(h.match(/class="lb"/g)).toHaveLength(200);
  });
});

describe('newInternalCode', () => {
  it('avoids existing codes', () => {
    const code = newInternalCode(new Set(['K0000001']));
    expect(code).toMatch(/^K/);
    expect(code).not.toBe('K0000001');
  });
});
