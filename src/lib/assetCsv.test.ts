import { describe, expect, it } from 'vitest';
import { TEMPLATE_CSV, dupKey, normalizeRaw, parseAssetCsv, parseCsv, type RawRow } from './assetCsv';

const raw = (over: Partial<RawRow> = {}): RawRow => ({
  name: 'Test', type: '', category: '', accountNumber: '', currency: '', value: '100',
  quantity: '', ticker: '', pillar: '', owner: '', ...over,
});

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, embedded newlines and CRLF', () => {
    expect(parseCsv('a,b\r\n"x\ny","he said ""hi"""\r\n')).toEqual([['a', 'b'], ['x\ny', 'he said "hi"']]);
  });
  it('strips a BOM and sniffs semicolon and tab delimiters', () => {
    expect(parseCsv('﻿a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('drops blank lines', () => {
    expect(parseCsv('a,b\n\n1,2\n,\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('normalizeRaw', () => {
  it.each([
    ['1,234', 1234], ['1,234.56', 1234.56], ['1.234,56', 1234.56], ['12,5', 12.5],
    ['1,25,000', 125000], ['$12,500', 12500], ['12,345,678', 12345678],
  ])('parses %s as %s', (v, n) => {
    expect(normalizeRaw(raw({ value: v }), 'USD').clean?.value).toBe(n);
  });

  it('uses the base currency when none is given and maps friendly types', () => {
    const c = normalizeRaw(raw({ type: 'savings' }), 'INR').clean!;
    expect(c.currency).toBe('INR');
    expect(c.assetType).toBe('CASH');
    expect(c.accountCategory).toBe('INDIVIDUAL');
  });

  it('treats debts as positive liabilities with the LIABILITY category', () => {
    const c = normalizeRaw(raw({ type: 'mortgage', value: '(5,000)' }), 'USD').clean!;
    expect(c.assetType).toBe('LIABILITY');
    expect(c.accountCategory).toBe('LIABILITY');
    expect(c.value).toBe(5000);
  });

  it('rejects negative asset values, unsupported currencies and missing names', () => {
    expect(normalizeRaw(raw({ value: '-5', type: 'cash' }), 'USD').errors.join()).toMatch(/negative/);
    expect(normalizeRaw(raw({ currency: 'XXX' }), 'USD').errors.join()).toMatch(/isn't supported/);
    expect(normalizeRaw(raw({ name: '  ' }), 'USD').errors.join()).toMatch(/Name/);
    expect(normalizeRaw(raw({ value: 'abc' }), 'USD').clean).toBeNull();
  });

  it('drops a ticker without a quantity (live prices would corrupt the value)', () => {
    const r = normalizeRaw(raw({ type: 'stock', ticker: 'AAPL' }), 'USD');
    expect(r.clean?.ticker).toBeNull();
    expect(r.warnings.join()).toMatch(/Ticker ignored/);
    expect(normalizeRaw(raw({ type: 'stock', ticker: 'AAPL', quantity: '10' }), 'USD').clean?.ticker).toBe('AAPL');
  });

  it('falls back to Other / Individual with a warning for unknown type or category', () => {
    const r = normalizeRaw(raw({ type: 'weird', category: 'nope' }), 'USD');
    expect(r.clean?.assetType).toBe('OTHER');
    expect(r.clean?.accountCategory).toBe('INDIVIDUAL');
    expect(r.warnings).toHaveLength(2);
  });
});

describe('parseAssetCsv', () => {
  it('accepts the downloadable template as-is', () => {
    const r = parseAssetCsv(TEMPLATE_CSV, 'USD', new Set());
    expect(r.fatal).toBeUndefined();
    expect(r.rows.every((x) => x.clean && x.errors.length === 0)).toBe(true);
    expect(r.rows).toHaveLength(3);
  });

  it('reads the app\'s own export (alternate headings, quoted commas, Indian grouping)', () => {
    const csv =
      'Name,Type,Account Category,Account Number,Currency,Native Value,Quantity,Owner,Legacy Pillar,Beneficiary,Access Notes,Updated At\r\n' +
      '"Fund, Growth",MUTUAL_FUND,INDIVIDUAL,AB12,INR,"1,25,000.50",10,Kavin,Growth,,"note ""x""",2026-01-01T00:00:00.000Z\r\n';
    const row = parseAssetCsv(csv, 'USD', new Set()).rows[0];
    expect(row.clean).toMatchObject({ name: 'Fund, Growth', assetType: 'MUTUAL_FUND', currency: 'INR', value: 125000.5, accountNumber: 'AB12' });
  });

  it('flags duplicates against existing holdings and within the file', () => {
    const existing = new Set([dupKey('Checking', '1234', 'USD')]);
    const csv = 'Name,Value,Account Number\nChecking,10,1234\nNew,5,\nNew,6,\n';
    const rows = parseAssetCsv(csv, 'USD', existing).rows;
    expect(rows.map((r) => r.duplicate)).toEqual([true, false, true]);
  });

  it('reports a fatal error when Name or Value columns are missing', () => {
    expect(parseAssetCsv('Foo,Bar\n1,2\n', 'USD', new Set()).fatal).toMatch(/required columns/);
    expect(parseAssetCsv('Name,Value\n', 'USD', new Set()).fatal).toMatch(/no data rows/);
  });
});
