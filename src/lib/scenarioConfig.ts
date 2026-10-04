import { convert } from '@/lib/networth';
import { CURRENCIES } from '@/lib/onboarding';
import type { LifeEvent, PlanInputs } from '@/lib/retirementProjection';
import type { Result } from '@/lib/familyPlan';

// A saved what-if is a name plus a few overrides on top of the live plan.

export interface LifeEventInput {
  label: string;
  fromYear: number;
  toYear: number;
  /** Per year in the plan currency, today's money. Positive = cost, negative = money in. */
  amount: number;
}

export interface ScenarioConfig {
  retirementAge?: number;
  /** Monthly spending in `spendCurrency` (the plan currency when omitted). */
  monthlySpend?: number;
  spendCurrency?: string;
  /** Yearly real drift of the spending currency against the assets, % (0 = parity). */
  spendDriftPct?: number;
  returnPct?: number;
  inflationPct?: number;
  /** Portfolio drop on the day of retirement, %. */
  marketDropPct?: number;
  events?: LifeEventInput[];
}

export const MAX_SCENARIOS = 12;
export const MAX_EVENTS = 8;

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const num = (v: unknown): number | undefined => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
};
const within = (n: number | undefined, lo: number, hi: number): number | undefined =>
  n === undefined ? undefined : Math.min(hi, Math.max(lo, n));

export function sanitizeScenario(raw: Record<string, unknown>): Result<{ name: string; config: ScenarioConfig }> {
  const name = clip(raw.name, 60);
  if (!name) return { ok: false, error: 'Give the scenario a name.' };
  const c = (raw.config && typeof raw.config === 'object' ? raw.config : {}) as Record<string, unknown>;

  const config: ScenarioConfig = {};
  const retirementAge = within(num(c.retirementAge), 30, 90);
  if (retirementAge !== undefined) config.retirementAge = Math.round(retirementAge);
  const monthlySpend = within(num(c.monthlySpend), 0, 1e9);
  if (monthlySpend !== undefined) config.monthlySpend = monthlySpend;
  const ccy = clip(c.spendCurrency, 3).toUpperCase();
  if (ccy && CURRENCIES.includes(ccy)) config.spendCurrency = ccy;
  const drift = within(num(c.spendDriftPct), -10, 10);
  if (drift !== undefined) config.spendDriftPct = drift;
  const ret = within(num(c.returnPct), -5, 25);
  if (ret !== undefined) config.returnPct = ret;
  const infl = within(num(c.inflationPct), -2, 25);
  if (infl !== undefined) config.inflationPct = infl;
  const drop = within(num(c.marketDropPct), 0, 80);
  if (drop !== undefined) config.marketDropPct = drop;

  if (Array.isArray(c.events)) {
    const events: LifeEventInput[] = [];
    for (const e of c.events.slice(0, MAX_EVENTS)) {
      const label = clip(e?.label, 60);
      const from = num(e?.fromYear);
      const to = num(e?.toYear ?? e?.fromYear);
      const amount = within(num(e?.amount), -1e9, 1e9);
      if (!label || from === undefined || to === undefined || amount === undefined) continue;
      const f = Math.round(from);
      const t = Math.round(to);
      if (f < 1900 || t > 2200 || t < f) continue;
      events.push({ label, fromYear: f, toYear: t, amount });
    }
    if (events.length) config.events = events;
  }
  if (Object.keys(config).length === 0) return { ok: false, error: 'Change at least one assumption.' };
  return { ok: true, value: { name, config } };
}

/** Turn a saved scenario into the inputs the projection engine runs on. */
export function applyScenario(
  base: PlanInputs,
  cfg: ScenarioConfig,
  ctx: { planCurrency: string; rates: Record<string, number>; year: number },
): { inputs: PlanInputs; shock: number } {
  const events: LifeEvent[] = (cfg.events ?? []).map((e) => ({
    label: e.label,
    fromAge: base.currentAge + (e.fromYear - ctx.year),
    toAge: base.currentAge + (e.toYear - ctx.year),
    amount: e.amount,
  }));
  const annualSpend =
    cfg.monthlySpend !== undefined
      ? convert(cfg.monthlySpend * 12, cfg.spendCurrency || ctx.planCurrency, ctx.planCurrency, ctx.rates)
      : base.annualSpend;
  return {
    inputs: {
      ...base,
      retirementAge: cfg.retirementAge ?? base.retirementAge,
      annualSpend,
      returnPct: cfg.returnPct ?? base.returnPct,
      inflationPct: cfg.inflationPct ?? base.inflationPct,
      spendDriftPct: cfg.spendDriftPct ?? base.spendDriftPct,
      events: [...(base.events ?? []), ...events],
    },
    shock: (cfg.marketDropPct ?? 0) / 100,
  };
}

export const TEMPLATES: { key: string; label: string; name: string; config: ScenarioConfig }[] = [
  { key: 'r55', label: 'Retire at 55', name: 'Retire at 55', config: { retirementAge: 55 } },
  { key: 'r62', label: 'Retire at 62', name: 'Retire at 62', config: { retirementAge: 62 } },
  { key: 'r67', label: 'Retire at 67', name: 'Retire at 67', config: { retirementAge: 67 } },
  { key: 'down', label: 'Market downturn −30%', name: 'Market downturn −30%', config: { marketDropPct: 30 } },
];
