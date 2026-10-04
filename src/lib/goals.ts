// Goal progress for the dashboard. A "goal" is a Wealth Pillar that has a
// target amount (Settings -> Wealth pillars); progress is the value of every
// holding whose purpose (rationale) matches the pillar name, in the base
// currency. Pure and shared so the numbers match the Settings card.

export interface Goal {
  name: string;
  description: string;
  target: number;
  targetDate: string | null;
  current: number;
  pct: number; // 0-100
  daysLeft: number | null; // negative once the date has passed
  monthlyNeeded: number | null; // simple straight-line estimate, ignores growth
  status: 'reached' | 'overdue' | 'open';
}

function convert(amount: number, from: string, to: string, rates: Record<string, number>): number {
  if (!from || !to || from === to) return amount;
  return (amount * (rates[to] || 1)) / (rates[from] || 1);
}

export function computeGoals(
  rawPillars: unknown,
  assets: any[],
  baseCurrency: string,
  rates: Record<string, number>,
  now = Date.now(),
): Goal[] {
  let parsed: any[] = [];
  try {
    const p = JSON.parse((rawPillars as string) || '[]');
    if (Array.isArray(p)) parsed = p;
  } catch {
    return []; // legacy comma-separated pillars have no targets
  }

  const currentByName = new Map<string, number>();
  for (const a of assets) {
    const type = (a.assetType || '').toUpperCase();
    const cat = (a.accountCategory || '').toUpperCase();
    if (type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY') continue;
    const name = (a.rationale || '').trim();
    if (!name) continue;
    const val = Math.abs(
      convert(parseFloat(a.nativeValue || '0'), a.nativeCurrency || 'USD', baseCurrency, rates),
    );
    currentByName.set(name, (currentByName.get(name) || 0) + val);
  }

  const goals: Goal[] = [];
  for (const p of parsed) {
    if (!p || typeof p !== 'object') continue;
    const name = String(p.name || '').trim();
    const target = typeof p.target === 'number' && p.target > 0 ? p.target : 0;
    if (!name || !target) continue;
    const targetDate =
      typeof p.targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.targetDate) ? p.targetDate : null;
    const current = currentByName.get(name) || 0;
    const pct = Math.min(100, (current / target) * 100);
    const daysLeft = targetDate
      ? Math.round((new Date(`${targetDate}T00:00:00`).getTime() - now) / 86400000)
      : null;
    const reached = current >= target;
    const monthlyNeeded =
      !reached && daysLeft !== null && daysLeft > 0
        ? (target - current) / Math.max(1, daysLeft / 30.44)
        : null;
    goals.push({
      name,
      description: String(p.description || ''),
      target,
      targetDate,
      current,
      pct,
      daysLeft,
      monthlyNeeded,
      status: reached ? 'reached' : daysLeft !== null && daysLeft < 0 ? 'overdue' : 'open',
    });
  }
  return goals;
}
