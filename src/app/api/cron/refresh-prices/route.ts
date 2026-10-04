import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { assets } from '@/db/schema';
import { and, isNotNull, ne } from 'drizzle-orm';
import { refreshAssetPrices } from '@/lib/priceRefresh';
import { logError } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

// Daily, just before the net-worth snapshot (see vercel.json), so snapshots,
// the trend chart, the widget and the weekly digest use current prices instead
// of whenever somebody last tapped "Refresh prices". Invoked by Vercel Cron
// with `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const rows = await db
      .select()
      .from(assets)
      .where(and(isNotNull(assets.ticker), ne(assets.ticker, '')));
    // Stop starting new quotes after ~50s so the job always finishes in time.
    const updated = await refreshAssetPrices(rows, Date.now() + 50_000);
    return NextResponse.json({ ok: true, candidates: rows.length, updated });
  } catch (err) {
    logError('cron/refresh-prices', err);
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 });
  }
}
