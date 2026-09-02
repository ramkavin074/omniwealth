import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { storeProducts, stores } from '@/db/schema';
import { logError } from '@/lib/log';
import { sendWhatsAppText } from '@/lib/whatsapp';

// Daily: for each store, WhatsApp its owner a digest of items that are low on
// stock and/or expiring within 7 days. No-ops safely until WHATSAPP_TOKEN/
// PHONE_ID are set.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
}

function isoDaysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function run() {
  const allStores = await db.select().from(stores);
  const soon = isoDaysFromNow(7);
  let sent = 0;
  let skipped = 0;

  for (const s of allStores) {
    if (!s.alertPhone) continue;

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

    const expiring = await db
      .select()
      .from(storeProducts)
      .where(
        and(
          eq(storeProducts.storeId, s.id),
          isNull(storeProducts.deletedAt),
          sql`${storeProducts.expiryDate} is not null`,
          sql`${storeProducts.expiryDate} <= ${soon}`,
          sql`${storeProducts.stockQty}::numeric > 0`,
        ),
      );

    if (low.length === 0 && expiring.length === 0) continue;

    const parts: string[] = [];
    if (low.length) {
      parts.push(
        `${low.length} item(s) low on stock\n` +
          low
            .slice(0, 30)
            .map((p) => `• ${p.name} — ${p.stockQty} ${p.unit}`)
            .join('\n'),
      );
    }
    if (expiring.length) {
      parts.push(
        `${expiring.length} item(s) expiring by ${soon}\n` +
          expiring
            .slice(0, 30)
            .map((p) => `• ${p.name} — exp ${p.expiryDate}`)
            .join('\n'),
      );
    }
    const body = `${s.name}\n\n${parts.join('\n\n')}`;

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
