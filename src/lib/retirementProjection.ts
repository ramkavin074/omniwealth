// "Will my money last?" engine. Everything is in today's money (real terms),
// matching RetirementCalculator: growth uses the inflation-adjusted return.

export const LIFE_EXPECTANCY = 90;

export interface PlanInputs {
  currentAge: number;
  retirementAge: number;
  savings: number;
  monthlyContribution: number;
  returnPct: number;
  inflationPct: number;
  /** Yearly spending wanted in retirement, today's money. */
  annualSpend: number;
}

export interface Projection {
  /** Balance at the start of each age, from the current age to LIFE_EXPECTANCY. */
  points: { age: number; balance: number }[];
  /** Age at which the money can no longer cover a full year, or null if it lasts. */
  depletedAge: number | null;
  balanceAtRetirement: number;
  balanceAtEnd: number;
  /** Highest yearly spend that still lasts to LIFE_EXPECTANCY. */
  sustainableAnnual: number;
}

const realRate = (p: PlanInputs) => (1 + p.returnPct / 100) / (1 + p.inflationPct / 100) - 1;

function run(p: PlanInputs, spend: number, shock: number) {
  const real = realRate(p);
  const m = Math.pow(1 + real, 1 / 12) - 1;
  const start = Math.round(p.currentAge);
  const retire = Math.max(start, Math.round(p.retirementAge));
  const end = LIFE_EXPECTANCY;

  let balance = Math.max(0, p.savings);
  let balanceAtRetirement = balance;
  let depletedAge: number | null = null;
  const points: { age: number; balance: number }[] = [];

  for (let age = start; age < end; age++) {
    if (age === retire) {
      balance *= 1 - shock;
      balanceAtRetirement = balance;
    }
    points.push({ age, balance });
    if (age < retire) {
      for (let i = 0; i < 12; i++) balance = balance * (1 + m) + p.monthlyContribution;
    } else if (balance + 1e-6 < spend) {
      if (depletedAge === null) depletedAge = age;
      balance = 0;
    } else {
      balance = (balance - spend) * (1 + real);
    }
  }
  if (retire >= end) balanceAtRetirement = balance;
  points.push({ age: end, balance });
  return { points, depletedAge, balanceAtRetirement, balanceAtEnd: balance };
}

/** `shock` is a fractional drop in the portfolio on the day of retirement (0.3 = -30%). */
export function project(p: PlanInputs, shock = 0): Projection {
  const base = run(p, Math.max(0, p.annualSpend), shock);

  // Largest spend that still lasts to the end age (balance only falls as spend rises).
  let lo = 0;
  let hi = Math.max(base.balanceAtRetirement, 1) * 2;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (run(p, mid, shock).depletedAge === null) lo = mid;
    else hi = mid;
  }
  return { ...base, sustainableAnnual: lo };
}

export interface Scenario {
  key: string;
  label: string;
  hint: string;
  apply: (p: PlanInputs) => { inputs: PlanInputs; shock: number };
}

export const SCENARIOS: Scenario[] = [
  { key: 'base', label: 'Your plan', hint: 'The numbers as entered', apply: (p) => ({ inputs: p, shock: 0 }) },
  {
    key: 'lowReturns',
    label: 'Returns 2% lower',
    hint: 'Markets underdeliver',
    apply: (p) => ({ inputs: { ...p, returnPct: p.returnPct - 2 }, shock: 0 }),
  },
  {
    key: 'crash',
    label: 'Market drop of 30% at retirement',
    hint: 'A bad first year',
    apply: (p) => ({ inputs: p, shock: 0.3 }),
  },
  {
    key: 'inflation',
    label: 'Inflation 2% higher',
    hint: 'Prices rise faster',
    apply: (p) => ({ inputs: { ...p, inflationPct: p.inflationPct + 2 }, shock: 0 }),
  },
  {
    key: 'spend',
    label: 'Spend 20% more',
    hint: 'A pricier lifestyle',
    apply: (p) => ({ inputs: { ...p, annualSpend: p.annualSpend * 1.2 }, shock: 0 }),
  },
  {
    key: 'later',
    label: 'Retire 3 years later',
    hint: 'Work a little longer',
    apply: (p) => ({ inputs: { ...p, retirementAge: p.retirementAge + 3 }, shock: 0 }),
  },
];
