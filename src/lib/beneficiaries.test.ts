import { describe, expect, it } from 'vitest';
import {
  beneficiaryStatus,
  formatBeneficiaries,
  normalizeBeneficiary,
  parseBeneficiaries,
  serializeBeneficiaries,
} from './beneficiaries';

describe('beneficiaries', () => {
  it('reads legacy plain text as one beneficiary', () => {
    expect(parseBeneficiaries('Spouse — Priya')).toEqual([{ name: 'Spouse — Priya', relationship: '', percent: null }]);
    expect(parseBeneficiaries('')).toEqual([]);
    expect(parseBeneficiaries(null)).toEqual([]);
  });

  it('round-trips structured rows and keeps a lone bare name as plain text', () => {
    const rows = [
      { name: 'Priya', relationship: 'Spouse', percent: 60 },
      { name: 'Arun', relationship: 'Son', percent: 40 },
    ];
    expect(parseBeneficiaries(serializeBeneficiaries(rows))).toEqual(rows);
    expect(serializeBeneficiaries([{ name: 'Priya', relationship: '', percent: null }])).toBe('Priya');
    expect(serializeBeneficiaries([{ name: '  ', relationship: 'x', percent: 5 }])).toBe('');
  });

  it('sanitises hostile or malformed JSON', () => {
    const raw = JSON.stringify([{ name: 'A', percent: 500 }, { name: '' }, { name: 'B', percent: '30' }, 7]);
    expect(parseBeneficiaries(raw)).toEqual([
      { name: 'A', relationship: '', percent: null },
      { name: 'B', relationship: '', percent: 30 },
    ]);
    expect(parseBeneficiaries('[not json')[0].name).toBe('[not json');
    expect(normalizeBeneficiary('   ')).toBeNull();
  });

  it('formats for display', () => {
    const raw = serializeBeneficiaries([
      { name: 'Priya', relationship: 'Spouse', percent: 60 },
      { name: 'Arun', relationship: '', percent: 40 },
    ]);
    expect(formatBeneficiaries(raw)).toBe('Priya (Spouse) 60%, Arun 40%');
  });

  it('flags shares that do not add up to 100', () => {
    const mk = (a: number | null, b: number | null) =>
      serializeBeneficiaries([
        { name: 'A', relationship: 'x', percent: a },
        { name: 'B', relationship: 'y', percent: b },
      ]);
    expect(beneficiaryStatus('')).toBe('none');
    expect(beneficiaryStatus('Priya')).toBe('ok');
    expect(beneficiaryStatus(mk(60, 40))).toBe('ok');
    expect(beneficiaryStatus(mk(60, 30))).toBe('shares');
    expect(beneficiaryStatus(mk(60, null))).toBe('shares');
    expect(beneficiaryStatus(mk(null, null))).toBe('ok');
  });
});
