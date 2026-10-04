import { describe, expect, it } from 'vitest';
import { applyScenario, sanitizeScenario } from './scenarioConfig';
import { project, type PlanInputs } from './retirementProjection';

const base: PlanInputs = { currentAge: 40, retirementAge: 62, savings: 400_000, monthlyContribution: 2000, returnPct: 7, inflationPct: 2.5, annualSpend: 60_000, endAge: 95 };
const ctx = { planCurrency: 'USD', rates: { USD: 1, INR: 80 }, year: 2026 };

describe('life events and drift in the engine', () => {
  it('a retirement-era cost lowers what the money can fund', () => {
    const plain = project(base);
    const withEvent = project({ ...base, events: [{ label: 'College', fromAge: 66, toAge: 70, amount: 30_000 }] });
    expect(withEvent.sustainableAnnual).toBeLessThan(plain.sustainableAnnual);
    expect(withEvent.balanceAtEnd).toBeLessThan(plain.balanceAtEnd);
  });

  it('money coming in helps, and a cost bigger than savings flags a shortfall', () => {
    expect(project({ ...base, events: [{ label: 'Sell house', fromAge: 70, toAge: 70, amount: -200_000 }] }).balanceAtEnd).toBeGreaterThan(project(base).balanceAtEnd);
    const broke = project({ ...base, savings: 10_000, events: [{ label: 'House', fromAge: 41, toAge: 41, amount: 500_000 }] });
    expect(broke.depletedAge).toBe(41);
  });

  it('a spending currency that gets dearer shortens how long money lasts', () => {
    expect(project({ ...base, spendDriftPct: 2 }).sustainableAnnual).toBeLessThan(project(base).sustainableAnnual);
    expect(project({ ...base, spendDriftPct: -2 }).sustainableAnnual).toBeGreaterThan(project(base).sustainableAnnual);
  });
});

describe('sanitizeScenario', () => {
  it('requires a name and at least one change', () => {
    expect(sanitizeScenario({ name: '', config: { retirementAge: 60 } }).ok).toBe(false);
    expect(sanitizeScenario({ name: 'X', config: {} }).ok).toBe(false);
  });

  it('clamps numbers, drops bad currencies and events', () => {
    const r = sanitizeScenario({
      name: 'Test',
      config: {
        retirementAge: 200,
        spendCurrency: 'xyz',
        marketDropPct: 500,
        events: [{ label: 'ok', fromYear: 2030, toYear: 2034, amount: 5000 }, { label: '', fromYear: 2030, amount: 1 }, { label: 'backwards', fromYear: 2040, toYear: 2030, amount: 1 }],
      },
    });
    expect(r.ok && r.value.config).toEqual({ retirementAge: 90, marketDropPct: 80, events: [{ label: 'ok', fromYear: 2030, toYear: 2034, amount: 5000 }] });
  });
});

describe('applyScenario', () => {
  it('overrides age, converts spend currency and maps event years to ages', () => {
    const { inputs, shock } = applyScenario(
      base,
      { retirementAge: 55, monthlySpend: 400_000, spendCurrency: 'INR', marketDropPct: 30, events: [{ label: 'College', fromYear: 2034, toYear: 2038, amount: 20_000 }] },
      ctx,
    );
    expect(inputs.retirementAge).toBe(55);
    expect(inputs.annualSpend).toBeCloseTo(60_000, 0); // 400k INR * 12 / 80
    expect(shock).toBeCloseTo(0.3);
    expect(inputs.events).toEqual([{ label: 'College', fromAge: 48, toAge: 52, amount: 20_000 }]);
  });
});
