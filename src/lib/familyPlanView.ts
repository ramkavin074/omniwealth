import { convert } from '@/lib/networth';
import { beneficiaryStatus, parseBeneficiaries, type Beneficiary } from '@/lib/beneficiaries';

const CATEGORY_LABELS: Record<string, string> = {
  REAL_ESTATE: 'Real estate',
  SOCIAL_SECURITY: 'Social Security',
  ROTH_IRA: 'Roth IRA',
  IRA: 'Traditional IRA',
  '401K': '401(k)',
  PPF: 'PPF',
  PF: 'PF / EPF',
  HSA: 'HSA',
  PENSION: 'Pension',
  '529': '529 College',
  TRUST: 'Trust',
  INDIVIDUAL: 'Individual',
};

export function categoryLabel(cat: string): string {
  const c = (cat || 'INDIVIDUAL').toUpperCase();
  return CATEGORY_LABELS[c] || c.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (x) => x.toUpperCase());
}

export interface PlanAccount {
  key: string;
  label: string;
  owners: string[];
  holdings: string[];
  value: number;
  beneficiaries: Beneficiary[];
  status: 'none' | 'shares' | 'ok';
  accessNotes: string[];
  instructions: string;
}

export interface PlanDebt {
  name: string;
  value: number;
}

const isLiability = (a: any) => {
  const type = (a.assetType || '').toUpperCase();
  const cat = (a.accountCategory || '').toUpperCase();
  return type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY';
};

/** Group holdings into accounts (category + account number) for the family plan. */
export function buildPlanAccounts(
  rows: any[],
  baseCurrency: string,
  rates: Record<string, number>,
  instructionsJson: string | null | undefined,
): { accounts: PlanAccount[]; debts: PlanDebt[] } {
  let instructions: Record<string, string> = {};
  try {
    const m = JSON.parse(instructionsJson || '{}');
    if (m && typeof m === 'object' && !Array.isArray(m)) instructions = m;
  } catch {
    /* ignore */
  }

  const map = new Map<string, PlanAccount>();
  const debts: PlanDebt[] = [];
  for (const a of rows) {
    const value = Math.abs(convert(parseFloat(a.nativeValue || '0'), a.nativeCurrency || 'USD', baseCurrency, rates));
    if (isLiability(a)) {
      debts.push({ name: a.name || 'Debt', value });
      continue;
    }
    const cat = (a.accountCategory || '').toUpperCase();
    const num = (a.accountNumber || '').trim();
    const key = `${cat}|${num}`;
    let acct = map.get(key);
    if (!acct) {
      acct = {
        key,
        label: num && num.toUpperCase() !== 'DEFAULT' ? `${categoryLabel(cat)} · ${num}` : categoryLabel(cat),
        owners: [],
        holdings: [],
        value: 0,
        beneficiaries: [],
        status: 'none',
        accessNotes: [],
        instructions: (instructions[key] || '').trim(),
      };
      map.set(key, acct);
    }
    acct.value += value;
    if (a.name) acct.holdings.push(a.name);
    const owner = a.user?.fullName;
    if (owner && !acct.owners.includes(owner)) acct.owners.push(owner);
    const note = (a.accessNotes || '').trim();
    if (note && !acct.accessNotes.includes(note)) acct.accessNotes.push(note);
    if (acct.beneficiaries.length === 0 && (a.beneficiary || '').trim()) {
      acct.beneficiaries = parseBeneficiaries(a.beneficiary);
      acct.status = beneficiaryStatus(a.beneficiary);
    }
  }
  const accounts = [...map.values()].sort((x, y) => y.value - x.value);
  return { accounts, debts: debts.sort((x, y) => y.value - x.value) };
}
