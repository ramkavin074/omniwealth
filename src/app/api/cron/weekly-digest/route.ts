import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { Resend } from 'resend';
import { db } from '@/db';
import { households, assets, users, netWorthSnapshots } from '@/db/schema';
import { fetchLiveExchangeRatesAction } from '@/actions/vault';
import { netWorthOf } from '@/lib/networth';
import { formatFull } from '@/lib/format';
import { logError } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

function digestHtml(opts: {
  name: string;
  base: string;
  current: number;
  delta: number | null;
  sinceDate: string | null;
}): string {
  const { name, base, current, delta, sinceDate } = opts;
  let change = '';
  if (delta != null) {
    const up = delta >= 0;
    const pct = current - delta !== 0 ? (delta / Math.abs(current - delta)) * 100 : 0;
    change = `
      <p style="margin: 8px 0 0; font-size: 14px; color: ${up ? '#059669' : '#dc2626'};">
        ${up ? '▲' : '▼'} ${formatFull(Math.abs(delta), base)} ${base}
        (${up ? '+' : '-'}${Math.abs(pct).toFixed(1)}%)${sinceDate ? ` since ${sinceDate}` : ''}
      </p>`;
  }
  return `
    <div style="font-family: sans-serif; background-color: #020617; color: #f8fafc; padding: 32px; border-radius: 16px;">
      <h2 style="color: #6366f1; margin-top: 0;">Weekly Net-Worth Digest</h2>
      <p style="margin: 0 0 16px; color: #cbd5e1;">Hi ${name || 'there'}, here's where the household stands.</p>
      <div style="background: #0f172a; border: 1px solid #1e293b; padding: 20px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Household net worth</p>
        <p style="margin: 4px 0 0; font-size: 28px; font-weight: bold; color: #38bdf8;">
          ${formatFull(current, base)} <span style="font-size: 16px; color: #64748b;">${base}</span>
        </p>
        ${change}
      </div>
      <p style="font-size: 12px; color: #94a3b8;">
        You're getting this because the weekly digest is on for your account. Turn it off in
        Household Settings &rarr; Notifications.
      </p>
    </div>`;
}

async function run() {
  const optedIn = (await db.select().from(users)).filter((u) => u.emailDigest && u.email);
  if (optedIn.length === 0) return { optedIn: 0, sent: 0 };

  const rates = await fetchLiveExchangeRatesAction();
  const allHouseholds = await db.select().from(households);
  const allAssets = await db.select().from(assets);
  const snaps = await db
    .select()
    .from(netWorthSnapshots)
    .orderBy(desc(netWorthSnapshots.snapshotDate));

  // Most recent recorded snapshot per household → the "since last time" baseline.
  const baseline = new Map<string, { total: number; date: string }>();
  for (const s of snaps) {
    if (!baseline.has(s.householdId)) {
      baseline.set(s.householdId, { total: parseFloat(s.total || '0'), date: s.snapshotDate });
    }
  }

  const from = process.env.RESEND_FROM_EMAIL || 'Global Family Vault <onboarding@resend.dev>';
  const resend = new Resend(process.env.RESEND_API_KEY);

  let sent = 0;
  for (const u of optedIn) {
    const hh = allHouseholds.find((h) => h.id === u.householdId);
    if (!hh) continue;
    const base = hh.baseCurrency || 'USD';
    const rows = allAssets.filter((a) => a.householdId === hh.id);
    const current = netWorthOf(rows, base, rates);
    const prev = baseline.get(hh.id);

    try {
      await resend.emails.send({
        from,
        to: u.email as string,
        subject: `Your weekly net-worth digest — ${formatFull(current, base)} ${base}`,
        html: digestHtml({
          name: u.fullName || '',
          base,
          current,
          delta: prev ? current - prev.total : null,
          sinceDate: prev ? prev.date : null,
        }),
      });
      sent++;
    } catch (err) {
      logError('cron/weekly-digest.send', err, { userId: u.id });
    }
  }

  return { optedIn: optedIn.length, sent };
}

// Weekly via Vercel Cron (see vercel.json). Vercel attaches
// `Authorization: Bearer $CRON_SECRET` automatically when CRON_SECRET is set.
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await run();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logError('cron/weekly-digest', err);
    return NextResponse.json({ ok: false, error: 'Digest run failed' }, { status: 500 });
  }
}
