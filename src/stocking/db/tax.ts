// Tax-filing helper, computed entirely on-device from the sales ledger.
// It does NOT file anything — it turns the shop's sales into the numbers a
// shopkeeper (or their accountant) needs, plus a due-date checklist.
//
// Assumptions, all conservative and flagged in the UI:
//  - Indian financial year: 1 Apr – 31 Mar.
//  - GST regular:  GSTR-3B, tax payable by the 20th of the next month.
//  - GST composition (trader): 1% of turnover, CMP-08 by the 18th after each quarter.
//  - Income tax presumptive (s.44AD): profit = 6% of digital receipts + 8% of the rest.
//  - Income tax on that profit: new regime, FY 2025-26 slabs (verify each year).

import { db } from './dexie';
import type { GstScheme, TaxRow } from '../types';

const r0 = (n: number) => Math.round(n);
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** The FY that a timestamp falls in, as its starting calendar year. */
export function fyStartYearOf(ms = Date.now()): number {
  const d = new Date(ms);
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

export function fyBounds(startYear: number): {
  from: number;
  to: number;
  label: string;
} {
  return {
    from: new Date(startYear, 3, 1).getTime(),
    to: new Date(startYear + 1, 3, 1).getTime(),
    label: `${startYear}-${String(startYear + 1).slice(2)}`,
  };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

// ---- income tax (new regime, FY 2025-26 — CONFIRM each year) ----
const SLABS: { upto: number; rate: number }[] = [
  { upto: 400000, rate: 0 },
  { upto: 800000, rate: 0.05 },
  { upto: 1200000, rate: 0.1 },
  { upto: 1600000, rate: 0.15 },
  { upto: 2000000, rate: 0.2 },
  { upto: 2400000, rate: 0.25 },
  { upto: Infinity, rate: 0.3 },
];

export function estimateIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  // s.87A rebate: new regime makes income up to ₹12L effectively tax-free.
  if (taxableIncome <= 1200000) return 0;
  let tax = 0;
  let prev = 0;
  for (const s of SLABS) {
    if (taxableIncome <= prev) break;
    const band = Math.min(taxableIncome, s.upto) - prev;
    tax += band * s.rate;
    prev = s.upto;
  }
  return r0(tax * 1.04); // + 4% health & education cess
}

export interface AdvanceInstalment {
  label: string;
  dueDate: string; // YYYY-MM-DD
  cumPercent: number;
  cumAmount: number;
  status: 'paid' | 'overdue' | 'due-soon' | 'upcoming';
  key: string;
}

function advanceSchedule(
  fyStartYear: number,
  totalTax: number,
  paid: Set<string>,
  now = Date.now(),
): AdvanceInstalment[] {
  const plan = [
    { m: 5, d: 15, cum: 0.15 }, // 15 Jun
    { m: 8, d: 15, cum: 0.45 }, // 15 Sep
    { m: 11, d: 15, cum: 0.75 }, // 15 Dec
    { m: 2, d: 15, cum: 1.0, nextYear: true }, // 15 Mar
  ];
  return plan.map((p, i) => {
    const due = new Date(
      p.nextYear ? fyStartYear + 1 : fyStartYear,
      p.m,
      p.d,
    );
    const key = `${fyStartYear}:adv:${i}`;
    const days = (due.getTime() - now) / 86_400_000;
    const status: AdvanceInstalment['status'] = paid.has(key)
      ? 'paid'
      : days < 0
        ? 'overdue'
        : days <= 15
          ? 'due-soon'
          : 'upcoming';
    return {
      label: due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      dueDate: iso(due),
      cumPercent: p.cum * 100,
      cumAmount: r0(totalTax * p.cum),
      status,
      key,
    };
  });
}

export interface GstMonth {
  month: string; // YYYY-MM
  sales: number; // invoice value in the month
  collected: number; // GST collected
  dueDate: string; // GSTR-3B pay-by
  key: string;
  done: boolean;
}

export interface CompositionQuarter {
  label: string;
  turnover: number;
  tax: number; // 1% of turnover
  dueDate: string; // CMP-08
  key: string;
  done: boolean;
}

export interface TaxReport {
  fyLabel: string;
  fyStartYear: number;
  turnover: number; // net of refunds
  cash: number;
  digital: number;
  billCount: number;
  refundTotal: number;
  gstEnabled: boolean;
  gstScheme: GstScheme;
  gstByRate: TaxRow[];
  gstCollected: number;
  gstMonths: GstMonth[];
  compositionQuarters: CompositionQuarter[];
  presumptive: boolean;
  presumptiveProfit: number;
  estimatedIncomeTax: number;
  advance: AdvanceInstalment[];
}

async function paidKeys(): Promise<Set<string>> {
  const rows = await db().taxNotes.toArray();
  return new Set(rows.filter((r) => r.done).map((r) => r.key));
}

export async function toggleTaxNote(key: string): Promise<void> {
  const cur = await db().taxNotes.get(key);
  await db().taxNotes.put({
    key,
    done: !cur?.done,
    note: cur?.note ?? '',
    updatedAt: Date.now(),
  });
}

export async function taxReport(
  fyStartYear: number,
  cfg: { gstEnabled: boolean; gstScheme: GstScheme; presumptive: boolean },
): Promise<TaxReport> {
  const { from, to, label } = fyBounds(fyStartYear);
  const [rows, paid] = await Promise.all([
    db().sales.where('createdAt').between(from, to, true, false).toArray(),
    paidKeys(),
  ]);
  const live = rows.filter((s) => s.deletedAt === null);

  let turnover = 0;
  let cash = 0;
  let digital = 0;
  let billCount = 0;
  let refundTotal = 0;
  let gstCollected = 0;
  const byRate = new Map<number, { taxable: number; cgst: number; sgst: number }>();
  const monthAgg = new Map<string, { sales: number; collected: number }>();

  for (const s of live) {
    turnover += s.total;
    cash += s.cashAmount;
    digital += s.upiAmount;
    gstCollected += s.taxTotal ?? 0;
    if (s.refundOf) refundTotal += -s.total;
    else billCount++;
    for (const r of s.taxBreakup ?? []) {
      const cur = byRate.get(r.rate) ?? { taxable: 0, cgst: 0, sgst: 0 };
      cur.taxable += r.taxable;
      cur.cgst += r.cgst;
      cur.sgst += r.sgst;
      byRate.set(r.rate, cur);
    }
    const mk = new Date(s.createdAt);
    const month = `${mk.getFullYear()}-${String(mk.getMonth() + 1).padStart(2, '0')}`;
    const m = monthAgg.get(month) ?? { sales: 0, collected: 0 };
    m.sales += s.total;
    m.collected += s.taxTotal ?? 0;
    monthAgg.set(month, m);
  }

  const gstByRate: TaxRow[] = [...byRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, v]) => ({
      rate,
      taxable: r2(v.taxable),
      cgst: r2(v.cgst),
      sgst: r2(v.sgst),
    }));

  const gstMonths: GstMonth[] = [];
  for (let i = 0; i < 12; i++) {
    const dt = new Date(fyStartYear, 3 + i, 1);
    const month = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const agg = monthAgg.get(month);
    if (!agg || (agg.sales === 0 && agg.collected === 0)) continue;
    const due = new Date(dt.getFullYear(), dt.getMonth() + 1, 20);
    const key = `${fyStartYear}:gst:${month}`;
    gstMonths.push({
      month,
      sales: r2(agg.sales),
      collected: r2(agg.collected),
      dueDate: iso(due),
      key,
      done: paid.has(key),
    });
  }

  const compositionQuarters: CompositionQuarter[] = [];
  if (cfg.gstEnabled && cfg.gstScheme === 'composition') {
    const qs = [
      { name: 'Apr–Jun', end: new Date(fyStartYear, 6, 18) },
      { name: 'Jul–Sep', end: new Date(fyStartYear, 9, 18) },
      { name: 'Oct–Dec', end: new Date(fyStartYear + 1, 0, 18) },
      { name: 'Jan–Mar', end: new Date(fyStartYear + 1, 3, 18) },
    ];
    qs.forEach((q, i) => {
      const qFrom = new Date(fyStartYear, 3 + i * 3, 1).getTime();
      const qTo = new Date(fyStartYear, 3 + i * 3 + 3, 1).getTime();
      const t = live
        .filter((s) => s.createdAt >= qFrom && s.createdAt < qTo)
        .reduce((sum, s) => sum + s.total, 0);
      const key = `${fyStartYear}:cmp:${i}`;
      compositionQuarters.push({
        label: q.name,
        turnover: r2(t),
        tax: r0(t * 0.01),
        dueDate: iso(q.end),
        key,
        done: paid.has(key),
      });
    });
  }

  const presumptiveProfit = cfg.presumptive
    ? r0(digital * 0.06 + Math.max(0, cash) * 0.08)
    : 0;
  const estimatedIncomeTax = cfg.presumptive
    ? estimateIncomeTax(presumptiveProfit)
    : 0;
  const advance =
    cfg.presumptive && estimatedIncomeTax > 10000
      ? advanceSchedule(fyStartYear, estimatedIncomeTax, paid)
      : [];

  return {
    fyLabel: label,
    fyStartYear,
    turnover: r2(turnover),
    cash: r2(cash),
    digital: r2(digital),
    billCount,
    refundTotal: r2(refundTotal),
    gstEnabled: cfg.gstEnabled,
    gstScheme: cfg.gstScheme,
    gstByRate,
    gstCollected: r2(gstCollected),
    gstMonths,
    compositionQuarters,
    presumptive: cfg.presumptive,
    presumptiveProfit,
    estimatedIncomeTax,
    advance,
  };
}
