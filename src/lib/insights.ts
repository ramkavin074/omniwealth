import { convert } from '@/lib/networth';
import { buildPlanAccounts } from '@/lib/familyPlanView';
import { daysUntil } from '@/lib/familyPlan';
import type { Goal } from '@/lib/goals';

// Facts the app can state on its own — never advice. Existing banners already
// cover concentration and stale values, so they are not repeated here.

export interface Insight {
  id: string;
  tone: 'attention' | 'info';
  text: string;
  /** Dashboard tab where the user can act on it. */
  tab?: 'wealth' | 'retirement' | 'directives';
}

export interface InsightInput {
  assets: any[];
  baseCurrency: string;
  rates: Record<string, number>;
  goals: Goal[];
  reminders: { id: string; title: string; dueDate: string; doneAt: string | null }[];
  accountInstructions?: string | null;
  now?: number;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const isLiability = (a: any) => {
  const t = (a.assetType || '').toUpperCase();
  const c = (a.accountCategory || '').toUpperCase();
  return t === 'LIABILITY' || t === 'DEBT' || c === 'LIABILITY';
};

export function computeInsights(i: InsightInput): Insight[] {
  const now = i.now ?? Date.now();
  const out: Insight[] = [];

  // Deadlines
  const open = i.reminders.filter((r) => !r.doneAt).map((r) => ({ ...r, days: daysUntil(r.dueDate, now) }));
  for (const r of open.filter((x) => x.days < 0).slice(0, 2)) {
    out.push({ id: `rem-over-${r.id}`, tone: 'attention', text: `${r.title} was due ${Math.abs(r.days)} day${Math.abs(r.days) === 1 ? '' : 's'} ago.`, tab: 'directives' });
  }
  for (const r of open.filter((x) => x.days >= 0 && x.days <= 90).slice(0, 3)) {
    out.push({
      id: `rem-soon-${r.id}`,
      tone: r.days <= 14 ? 'attention' : 'info',
      text: r.days === 0 ? `${r.title} is due today.` : `${r.title} is due in ${plural(r.days, 'day')}.`,
      tab: 'directives',
    });
  }

  // Goals
  for (const g of i.goals) {
    if (g.status === 'overdue') {
      out.push({ id: `goal-over-${g.name}`, tone: 'attention', text: `"${g.name}" is ${Math.floor(g.pct)}% funded and its target date has passed.`, tab: 'wealth' });
    } else if (g.status === 'reached') {
      out.push({ id: `goal-done-${g.name}`, tone: 'info', text: `"${g.name}" has reached its target.`, tab: 'wealth' });
    } else if (g.pct >= 90) {
      out.push({ id: `goal-near-${g.name}`, tone: 'info', text: `"${g.name}" is ${Math.floor(g.pct)}% of the way to its target.`, tab: 'wealth' });
    }
  }

  // Estate readiness
  const { accounts } = buildPlanAccounts(i.assets, i.baseCurrency, i.rates, i.accountInstructions);
  const noInfo = accounts.filter((a) => a.beneficiaries.length === 0 && a.accessNotes.length === 0);
  const badShares = accounts.filter((a) => a.status === 'shares');
  if (noInfo.length > 0) {
    out.push({ id: 'estate-missing', tone: 'attention', text: `${plural(noInfo.length, 'account')} ${noInfo.length === 1 ? 'has' : 'have'} no beneficiary or access instructions recorded.`, tab: 'directives' });
  }
  if (badShares.length > 0) {
    out.push({ id: 'estate-shares', tone: 'attention', text: `${plural(badShares.length, 'account')} ${badShares.length === 1 ? 'has' : 'have'} beneficiary shares that do not add up to 100%.`, tab: 'directives' });
  }

  // Currency exposure
  const byCcy = new Map<string, number>();
  let total = 0;
  for (const a of i.assets) {
    if (isLiability(a)) continue;
    const ccy = (a.nativeCurrency || 'USD').toUpperCase();
    const v = Math.abs(convert(parseFloat(a.nativeValue || '0'), ccy, i.baseCurrency, i.rates));
    byCcy.set(ccy, (byCcy.get(ccy) || 0) + v);
    total += v;
  }
  if (total > 0) {
    const top = [...byCcy.entries()].filter(([c]) => c !== i.baseCurrency.toUpperCase()).sort((a, b) => b[1] - a[1])[0];
    if (top) {
      const pct = Math.round((top[1] / total) * 100);
      if (pct >= 40) out.push({ id: `fx-${top[0]}`, tone: 'info', text: `${pct}% of household assets are held in ${top[0]}, so exchange rates move your ${i.baseCurrency} total.`, tab: 'wealth' });
    }
  }

  const rank = { attention: 0, info: 1 } as const;
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}
