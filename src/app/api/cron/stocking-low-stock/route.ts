import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { storeProducts, stores } from '@/db/schema';
import { logError } from '@/lib/log';
import { sendWhatsAppText } from '@/lib/whatsapp';

// Daily: for each store, WhatsApp its owner(s) a list of items at/below their
// low-stock threshold. No-ops safely until WHATSAPP_TOKEN/PHONE_ID are set.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
}

async function run() {
  const allStores = await db.select().from(stores);
  let sent = 0;
  let skipped = 0;

  for (const s of allStores) {
    const low = await db
      .select()
      .from(storeProducts)
      .where(
        and(
          eq(storeProducts.storeId, s.id),
          isNull(storeProducts.deletedAt),
          sql`${storeProducts.stockQty}::numeric <= ${storeProducts.lowStockThreshold}::numeric`,
        ),
      );
    if (low.length === 0 || !s.alertPhone) continue;

    const list = low
      .slice(0, 40)
      .map((p) => `• ${p.name} — ${p.stockQty} ${p.unit}`)
      .join('\n');
    const body = `${s.name}: ${low.length} item(s) low on stock\n${list}`;

    const r = await sendWhatsAppText(s.alertPhone, body);
    if (r.skipped) skipped++;
    else if (r.ok) sent++;
  }
  return { stores: allStores.length, sent, skipped };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await run()) });
  } catch (e) {
    logError('cron/stocking-low-stock', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
