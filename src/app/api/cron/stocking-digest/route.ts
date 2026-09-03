import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  storeCustomers,
  storeProducts,
  storeReceipts,
  storeSales,
  stores,
} from '@/db/schema';
import { logError } from '@/lib/log';
import { sendWhatsAppText } from '@/lib/whatsapp';

// Evening: WhatsApp each store's owner a one-line "how today went" digest —
// sales, cash split, khata still to collect, and low-stock / expiry counts.
// Complements the morning stocking-low-stock alert (which carries the detail).
// No-ops safely until WHATSAPP_TOKEN / PHONE_ID are set.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
}

const rupee = (n: number) =>
  '₹' + Math.round(n).toLocaleString('en-IN');

async function run() {
  const allStores = await db.select().from(stores);
  let sent = 0;
  let skipped = 0;

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const from = String(dayStart.getTime());
  const to = String(Date.now());
  const soon = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  for (const s of allStores) {
    if (!s.alertPhone) continue;

    const [today] = await db
      .select({
        total: sql<string>`coalesce(sum(${storeSales.total}::numeric), 0)`,
        cash: sql<string>`coalesce(sum(${storeSales.cashAmount}::numeric), 0)`,
        upi: sql<string>`coalesce(sum(${storeSales.upiAmount}::numeric), 0)`,
        card: sql<string>`coalesce(sum(${storeSales.cardAmount}::numeric), 0)`,
        bills: sql<string>`count(*) filter (where ${storeSales.refundOf} is null)`,
        refunds: sql<string>`count(*) filter (where ${storeSales.refundOf} is not null)`,
      })
      .from(storeSales)
      .where(
        and(
          eq(storeSales.storeId, s.id),
          isNull(storeSales.deletedAt),
          gte(storeSales.createdAt, from),
          lt(storeSales.createdAt, to),
        ),
      );

    // Store-wide khata outstanding = Σ opening balances
    //   + Σ (credit portion of every customer-attributed bill, refunds netted)
    //   − Σ receipts.
    const [openBal] = await db
      .select({
        v: sql<string>`coalesce(sum(${storeCustomers.openingBalance}::numeric), 0)`,
      })
      .from(storeCustomers)
      .where(
        and(
          eq(storeCustomers.storeId, s.id),
          isNull(storeCustomers.deletedAt),
        ),
      );
    const [billed] = await db
      .select({
        v: sql<string>`coalesce(sum(
          ${storeSales.total}::numeric
          - ${storeSales.cashAmount}::numeric
          - ${storeSales.upiAmount}::numeric
          - ${storeSales.cardAmount}::numeric
        ), 0)`,
      })
      .from(storeSales)
      .where(
        and(
          eq(storeSales.storeId, s.id),
          isNull(storeSales.deletedAt),
          sql`${storeSales.customerId} is not null`,
        ),
      );
    const [paid] = await db
      .select({
        v: sql<string>`coalesce(sum(${storeReceipts.amount}::numeric), 0)`,
      })
      .from(storeReceipts)
      .where(
        and(
          eq(storeReceipts.storeId, s.id),
          isNull(storeReceipts.deletedAt),
        ),
      );
    const toCollect =
      Number(openBal?.v ?? 0) + Number(billed?.v ?? 0) - Number(paid?.v ?? 0);

    const [lowCnt] = await db
      .select({ n: sql<string>`count(*)` })
      .from(storeProducts)
      .where(
        and(
          eq(storeProducts.storeId, s.id),
          isNull(storeProducts.deletedAt),
          sql`${storeProducts.stockQty}::numeric <= ${storeProducts.lowStockThreshold}::numeric`,
        ),
      );
    const [expCnt] = await db
      .select({ n: sql<string>`count(*)` })
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

    const bills = Number(today?.bills ?? 0);
    const refunds = Number(today?.refunds ?? 0);
    const salesTotal = Number(today?.total ?? 0);
    // Nothing sold and nothing outstanding → skip, don't nag.
    if (bills === 0 && refunds === 0 && toCollect <= 0) continue;

    const lines: string[] = [
      `Sales today: ${rupee(salesTotal)} · ${bills} bill${bills === 1 ? '' : 's'}` +
        (refunds ? ` · ${refunds} refund${refunds === 1 ? '' : 's'}` : ''),
      `  cash ${rupee(Number(today?.cash ?? 0))} · UPI ${rupee(
        Number(today?.upi ?? 0),
      )} · card ${rupee(Number(today?.card ?? 0))}`,
    ];
    if (toCollect > 0) lines.push(`To collect (khata): ${rupee(toCollect)}`);
    const flags: string[] = [];
    if (Number(lowCnt?.n ?? 0) > 0) flags.push(`${lowCnt.n} low on stock`);
    if (Number(expCnt?.n ?? 0) > 0) flags.push(`${expCnt.n} expiring soon`);
    if (flags.length) lines.push(flags.join(' · '));

    const body = `${s.name} — end of day\n\n${lines.join('\n')}`;
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
    logError('cron/stocking-digest', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
