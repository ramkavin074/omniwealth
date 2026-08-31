import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { households, assets, netWorthSnapshots } from '@/db/schema';
import { fetchLiveExchangeRatesAction } from '@/actions/vault';
import { logError } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Same conversion the dashboard hero uses: rates are USD-based
// (units of `currency` per 1 USD), so cross-rate = amount * rateTo / rateFrom.
function convert(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): number {
  if (from === to) return amount;
  const rf = rates[from] || 1;
  const rt = rates[to] || 1;
  return (amount * rt) / rf;
}

// Mirrors UnifiedHeaderAndSummary's totalNetWorth: sum of +|value| for
// assets and -|value| for liabilities, converted to the base currency.
function netWorthOf(
  rows: Array<typeof assets.$inferSelect>,
  baseCurrency: string,
  rates: Record<string, number>,
): number {
  let total = 0;
  for (const a of rows) {
    const val = parseFloat(a.nativeValue || '0');
    const baseVal = convert(val, a.nativeCurrency || 'USD', baseCurrency, rates);
    const type = (a.assetType || '').toUpperCase();
    const rawCat = (a.accountCategory || 'INDIVIDUAL').toUpperCase();
    const isLiability =
      type === 'LIABILITY' || type === 'DEBT' || rawCat === 'LIABILITY';
    total += isLiability ? -Math.abs(baseVal) : Math.abs(baseVal);
  }
  return total;
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

async function run() {
  const rates = await fetchLiveExchangeRatesAction();
  const allHouseholds = await db.select().from(households);
  const allAssets = await db.select().from(assets);
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

  let written = 0;
  for (const h of allHouseholds) {
    const rows = allAssets.filter((a) => a.householdId === h.id);
    if (rows.length === 0) continue;
    const base = h.baseCurrency || 'USD';
    const total = String(Math.round(netWorthOf(rows, base, rates)));

    await db
      .insert(netWorthSnapshots)
      .values({
        householdId: h.id,
        currency: base,
        total,
        snapshotDate: today,
      })
      .onConflictDoUpdate({
        target: [netWorthSnapshots.householdId, netWorthSnapshots.snapshotDate],
        set: { total, currency: base },
      });
    written++;
  }

  return { households: allHouseholds.length, written, date: today };
}

// Invoked daily by Vercel Cron (see vercel.json). Vercel attaches
// `Authorization: Bearer $CRON_SECRET` automatically when CRON_SECRET is set.
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await run();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logError('cron/net-worth-snapshot', err);
    return NextResponse.json(
      { ok: false, error: 'Snapshot run failed' },
      { status: 500 },
    );
  }
}
