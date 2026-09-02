import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  storeProducts,
  storeSales,
  storeUpiReceipts,
  stores,
} from '@/db/schema';
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

/** Tax due dates in the next `window` days: GSTR-3B on the 20th (regular),
 *  CMP-08 on the 18th after a quarter (composition), advance tax on the 15th
 *  of Jun/Sep/Dec/Mar (presumptive). Returns human lines, or []. */
function taxDueLines(
  gstEnabled: boolean,
  gstScheme: string,
  presumptive: boolean,
  window = 7,
): string[] {
  const now = new Date();
  const soon = new Date(now.getTime() + window * 86_400_000);
  const within = (m: number, day: number) => {
    for (const yr of [now.getFullYear(), now.getFullYear() + 1]) {
      const d = new Date(yr, m, day);
      if (d >= now && d <= soon) return d.toISOString().slice(0, 10);
    }
    return null;
  };
  const out: string[] = [];
  if (gstEnabled && gstScheme === 'regular') {
    const d = within(now.getMonth(), 20) ?? within(now.getMonth() + 1, 20);
    if (d) out.push(`GST return (GSTR-3B) due ${d}`);
  }
  if (gstEnabled && gstScheme === 'composition') {
    for (const m of [3, 6, 9, 0]) {
      const d = within(m, 18);
      if (d) out.push(`GST composition (CMP-08) due ${d}`);
    }
  }
  if (presumptive) {
    for (const m of [5, 8, 11, 2]) {
      const d = within(m, 15);
      if (d) out.push(`Advance income tax instalment due ${d}`);
    }
  }
  return out;
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

    const taxLines = taxDueLines(s.gstEnabled, s.gstScheme, s.presumptive);

    // Yesterday's UPI reconciliation — only signal if the shop logged receipts.
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const yStart = String(dayStart.getTime() - 86_400_000);
    const yEnd = String(dayStart.getTime());
    const [rcpt] = await db
      .select({
        total: sql<string>`coalesce(sum(${storeUpiReceipts.amount}::numeric), 0)`,
        cnt: sql<string>`count(*)`,
      })
      .from(storeUpiReceipts)
      .where(
        and(
          eq(storeUpiReceipts.storeId, s.id),
          isNull(storeUpiReceipts.deletedAt),
          gte(storeUpiReceipts.receivedAt, yStart),
          lt(storeUpiReceipts.receivedAt, yEnd),
        ),
      );
    let upiLine: string | null = null;
    if (Number(rcpt?.cnt ?? 0) > 0) {
      const [sold] = await db
        .select({
          total: sql<string>`coalesce(sum(${storeSales.upiAmount}::numeric), 0)`,
        })
        .from(storeSales)
        .where(
          and(
            eq(storeSales.storeId, s.id),
            isNull(storeSales.deletedAt),
            isNull(storeSales.refundOf),
            gte(storeSales.createdAt, yStart),
            lt(storeSales.createdAt, yEnd),
          ),
        );
      const diff =
        Math.round((Number(rcpt.total) - Number(sold?.total ?? 0)) * 100) / 100;
      if (Math.abs(diff) >= 1) {
        upiLine =
          `UPI yesterday: bills ₹${Number(sold?.total ?? 0)} vs received ₹${Number(rcpt.total)} ` +
          `(off by ₹${diff})`;
      }
    }

    if (
      low.length === 0 &&
      expiring.length === 0 &&
      taxLines.length === 0 &&
      !upiLine
    ) {
      continue;
    }

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
    if (taxLines.length) {
      parts.push(taxLines.map((l) => `• ${l}`).join('\n'));
    }
    if (upiLine) parts.push(`• ${upiLine}`);
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
