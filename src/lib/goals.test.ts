import { describe, expect, it } from 'vitest';
import { computeGoals } from './goals';

const NOW = new Date('2026-10-04T00:00:00').getTime();
const pillars = JSON.stringify([
  { name: 'College', target: 150000, targetDate: '2030-10-04' },
  { name: 'Home', target: 100000, targetDate: '2026-06-01' },
  { name: 'Emergency', target: 20000 },
  { name: 'No target' },
]);

describe('computeGoals', () => {
  const assets = [
    { assetType: 'CASH', rationale: 'College', nativeValue: '45000', nativeCurrency: 'USD' },
    { assetType: 'STOCK', rationale: 'College', nativeValue: '3750000', nativeCurrency: 'INR' },
    { assetType: 'CASH', rationale: 'Home', nativeValue: '30000', nativeCurrency: 'USD' },
    { assetType: 'CASH', rationale: 'Emergency', nativeValue: '25000', nativeCurrency: 'USD' },
    { assetType: 'LIABILITY', rationale: 'College', nativeValue: '99999', nativeCurrency: 'USD' },
  ];
  const goals = computeGoals(pillars, assets, 'USD', { USD: 1, INR: 83.3 }, NOW);
  const by = (n: string) => goals.find((g) => g.name === n)!;

  it('only returns pillars that have a target and converts currencies, excluding debts', () => {
    expect(goals.map((g) => g.name)).toEqual(['College', 'Home', 'Emergency']);
    expect(Math.round(by('College').current)).toBe(90018);
  });
  it('classifies reached / overdue / open and estimates the monthly need', () => {
    expect(by('Emergency').status).toBe('reached');
    expect(by('Emergency').pct).toBe(100);
    expect(by('Home').status).toBe('overdue');
    expect(by('Home').monthlyNeeded).toBeNull();
    expect(by('College').status).toBe('open');
    expect(Math.round(by('College').monthlyNeeded!)).toBe(1250);
  });
  it('returns nothing for legacy comma-separated pillars or bad JSON', () => {
    expect(computeGoals('Growth - x, Legacy', [], 'USD', {}, NOW)).toEqual([]);
    expect(computeGoals(undefined, [], 'USD', {}, NOW)).toEqual([]);
  });
});
