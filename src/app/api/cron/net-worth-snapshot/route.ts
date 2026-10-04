import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { households, assets, netWorthSnapshots, users, notificationPrefs } from '@/db/schema';
import { desc, eq, lt } from 'drizzle-orm';
import { fetchLiveExchangeRatesAction } from '@/actions/vault';
import { netWorthOf } from '@/lib/networth';
import { logError } from '@/lib/log';
import { sendPushToUser } from '@/lib/push';
import { checkRateLimit } from '@/lib/rate-limit';
import { detectNetWorthMove, netWorthAlertText } from '@/lib/netWorthAlert';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

  // Yesterday's (most recent earlier) snapshot per household, for the alert.
  const earlier = await db
    .select()
    .from(netWorthSnapshots)
    .where(lt(netWorthSnapshots.snapshotDate, today))
    .orderBy(desc(netWorthSnapshots.snapshotDate));
  const previousByHousehold = new Map<string, { total: number; date: string }>();
  for (const e of earlier) {
    if (!previousByHousehold.has(e.householdId)) {
      previousByHousehold.set(e.householdId, { total: parseFloat(e.total || '0'), date: e.snapshotDate });
    }
  }

  // Members who switched the alert off (no row = on). Missing table = nobody opted out.
  let optedOut = new Set<string>();
  try {
    const off = await db
      .select({ userId: notificationPrefs.userId })
      .from(notificationPrefs)
      .where(eq(notificationPrefs.netWorthAlerts, false));
    optedOut = new Set(off.map((o) => o.userId));
  } catch {
    /* table not created yet */
  }
  const allUsers = await db.select({ id: users.id, householdId: users.householdId }).from(users);

  let written = 0;
  let alerts = 0;
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

    // Big day-over-day move -> one push per member (percent only, no amounts).
    // The snapshot is ~1 day old at most; skip if the last one is stale (job
    // missed days) so "since yesterday" stays truthful.
    const prev = previousByHousehold.get(h.id);
    const ageDays = prev ? (Date.parse(today) - Date.parse(prev.date)) / 86400000 : Infinity;
    const move = prev && ageDays <= 2 ? detectNetWorthMove(Number(total), prev.total) : null;
    if (move) {
      try {
        // At most one alert per household every 48h, with no extra table.
        const gate = await checkRateLimit(`nw-alert:${h.id}`, 1, 48 * 60);
        if (gate.allowed) {
          const text = netWorthAlertText(move);
          for (const u of allUsers) {
            if (u.householdId !== h.id || optedOut.has(u.id)) continue;
            const delivered = await sendPushToUser(u.id, {
              ...text,
              threadId: 'net-worth-move',
            });
            if (delivered > 0) alerts++;
          }
        }
      } catch (err) {
        logError('cron/net-worth-snapshot.alert', err, { householdId: h.id });
      }
    }
  }

  return { households: allHouseholds.length, written, alerts, date: today };
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
