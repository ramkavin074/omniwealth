import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { assets, households, widgetKeys } from '@/db/schema';
import { fetchLiveExchangeRatesAction } from '@/actions/vault';
import { netWorthOf } from '@/lib/networth';
import { checkRateLimit } from '@/lib/rate-limit';
import { hashWidgetKey, looksLikeWidgetKey, parseBearer } from '@/lib/widgetKey';
import { logError } from '@/lib/log';

export const dynamic = 'force-dynamic';

// Called by the phone's Home Screen widget (background refresh). Returns ONE
// number, the household net worth, to a holder of a valid widget key. Every
// failure looks the same (401) so keys can't be probed.

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
const denied = () => json({ error: 'unauthorized' }, 401);

export async function GET(request: Request) {
  try {
    const key = parseBearer(request.headers.get('authorization'));
    if (!looksLikeWidgetKey(key)) return denied();
    const keyHash = hashWidgetKey(key);

    const [row] = await db
      .select({ id: widgetKeys.id, householdId: widgetKeys.householdId })
      .from(widgetKeys)
      .where(and(eq(widgetKeys.keyHash, keyHash), isNull(widgetKeys.revokedAt), gt(widgetKeys.expiresAt, new Date())));
    if (!row) return denied();

    // A widget refreshes a few times a day; this only stops a runaway client.
    const gate = await checkRateLimit(`widget-fetch:${row.id}`, 60, 60);
    if (!gate.allowed) return json({ error: 'rate_limited' }, 429);

    const [hh] = await db.select().from(households).where(eq(households.id, row.householdId));
    if (!hh) return denied();
    const base = hh.baseCurrency || 'USD';
    const rows = await db.select().from(assets).where(eq(assets.householdId, row.householdId));
    const rates = await fetchLiveExchangeRatesAction();
    const amount = netWorthOf(rows, base, rates);

    // Best effort: when the key was last used (never blocks the answer).
    db.update(widgetKeys).set({ lastUsedAt: new Date() }).where(eq(widgetKeys.id, row.id)).catch(() => {});

    return json({ amount: Math.round(amount), currency: base, updatedAt: new Date().toISOString() }, 200);
  } catch (err) {
    logError('api/widget/net-worth', err);
    return json({ error: 'unavailable' }, 503);
  }
}
