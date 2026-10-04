import { describe, expect, it } from 'vitest';
import { computeInsights } from './insights';

const NOW = Date.parse('2026-10-04T12:00:00Z');
const asset = (o: any) => ({ assetType: 'STOCK', accountCategory: 'IRA', accountNumber: '1', nativeCurrency: 'USD', nativeValue: '100', ...o });
const base = { baseCurrency: 'USD', rates: { USD: 1, INR: 80 }, goals: [], reminders: [], now: NOW };

describe('computeInsights', () => {
  it('reports overdue and upcoming reminders, attention first', () => {
    const out = computeInsights({
      ...base,
      assets: [asset({ beneficiary: 'Priya' })],
      reminders: [
        { id: 'a', title: 'PPF matures', dueDate: '2026-12-20', doneAt: null },
        { id: 'b', title: 'Car insurance', dueDate: '2026-10-01', doneAt: null },
        { id: 'c', title: 'Done thing', dueDate: '2026-10-02', doneAt: '2026-10-02T00:00:00Z' },
      ],
    });
    expect(out[0].text).toBe('Car insurance was due 3 days ago.');
    expect(out.find((x) => x.id === 'rem-soon-a')?.text).toBe('PPF matures is due in 77 days.');
    expect(out.some((x) => x.text.includes('Done thing'))).toBe(false);
  });

  it('flags accounts with no beneficiary or access info, and bad shares', () => {
    const out = computeInsights({ ...base, assets: [asset({}), asset({ accountNumber: '2', beneficiary: JSON.stringify([{ name: 'A', relationship: 'x', percent: 50 }]) })] });
    expect(out.map((x) => x.id)).toEqual(expect.arrayContaining(['estate-missing', 'estate-shares']));
  });

  it('states large foreign-currency exposure', () => {
    const out = computeInsights({ ...base, assets: [asset({ beneficiary: 'x', nativeCurrency: 'INR', nativeValue: '16000' }), asset({ accountNumber: '9', beneficiary: 'x', nativeValue: '100' })] });
    expect(out.find((x) => x.id === 'fx-INR')?.text).toMatch(/^67% of household assets are held in INR/);
  });

  it('notes goals that are overdue or reached', () => {
    const goal = (o: any) => ({ name: 'G', description: '', target: 100, targetDate: null, current: 0, pct: 0, daysLeft: null, monthlyNeeded: null, status: 'open', ...o });
    const out = computeInsights({ ...base, assets: [asset({ beneficiary: 'x' })], goals: [goal({ name: 'Home', pct: 40, status: 'overdue' }), goal({ name: 'Fund', pct: 100, status: 'reached' })] });
    expect(out.map((x) => x.id)).toEqual(expect.arrayContaining(['goal-over-Home', 'goal-done-Fund']));
  });

  it('is quiet when there is nothing to say', () => {
    expect(computeInsights({ ...base, assets: [asset({ beneficiary: 'Priya' })] })).toEqual([]);
  });
});
