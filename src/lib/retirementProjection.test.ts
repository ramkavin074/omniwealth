import { describe, expect, it } from 'vitest';
import { SCENARIOS, project, type PlanInputs } from './retirementProjection';

const flat: PlanInputs = {
  currentAge: 65,
  retirementAge: 65,
  savings: 250_000,
  monthlyContribution: 0,
  returnPct: 0,
  inflationPct: 0,
  annualSpend: 10_000,
};

describe('project', () => {
  it('lasts exactly to 90 when savings cover 25 years of spending', () => {
    const r = project(flat);
    expect(r.depletedAge).toBeNull();
    expect(r.balanceAtEnd).toBeCloseTo(0, 3);
    expect(r.sustainableAnnual).toBeCloseTo(10_000, 0);
  });

  it('reports the age the money runs out', () => {
    const r = project({ ...flat, annualSpend: 20_000 });
    expect(r.depletedAge).toBe(65 + 12); // 12 full years of 20k from 250k
    expect(r.sustainableAnnual).toBeCloseTo(10_000, 0);
  });

  it('applies a drop on the day of retirement', () => {
    const r = project(flat, 0.5);
    expect(r.balanceAtRetirement).toBe(125_000);
    expect(r.depletedAge).not.toBeNull();
  });

  it('accumulates contributions before retirement', () => {
    const r = project({ ...flat, currentAge: 55, savings: 0, monthlyContribution: 1000 });
    expect(r.balanceAtRetirement).toBeCloseTo(120_000, 0);
  });

  it('handles no savings and no time without blowing up', () => {
    const r = project({ ...flat, savings: 0 });
    expect(r.depletedAge).toBe(65);
    expect(Number.isFinite(r.sustainableAnnual)).toBe(true);
  });

  it('scenarios only make things worse or better in the expected direction', () => {
    const p: PlanInputs = { ...flat, currentAge: 40, retirementAge: 65, savings: 200_000, monthlyContribution: 1500, returnPct: 7, inflationPct: 2.5, annualSpend: 60_000 };
    const by = Object.fromEntries(SCENARIOS.map((s) => {
      const { inputs, shock } = s.apply(p);
      return [s.key, project(inputs, shock).sustainableAnnual];
    }));
    expect(by.lowReturns).toBeLessThan(by.base);
    expect(by.crash).toBeLessThan(by.base);
    expect(by.inflation).toBeLessThan(by.base);
    expect(by.later).toBeGreaterThan(by.base);
  });
});
