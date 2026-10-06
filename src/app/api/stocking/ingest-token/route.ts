import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { storeSmsIngest } from '@/db/schema';
import { appUrl } from '@/lib/appUrl';
import { hashToken, newIngestToken } from '@/lib/smsIngest';
import { canEditCatalogue, resolveStockingAuth } from '@/lib/stockingAuth';
import { corsHeaders, corsPreflight } from '@/lib/stockingCors';

// Owner / manager manage the shop's private SMS link: status, create or replace, disconnect.

export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'));
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers });

  const auth = await resolveStockingAuth(request);
  if (!auth) return json({ error: 'Unauthorized' }, 401);
  if (!canEditCatalogue(auth.role)) return json({ error: 'Owner or manager only' }, 403);

  let action = 'status';
  try {
    const body = await request.json();
    if (typeof body?.action === 'string') action = body.action;
  } catch {
    /* default to status */
  }

  if (action === 'create') {
    const token = newIngestToken();
    const tokenHash = hashToken(token);
    await db
      .insert(storeSmsIngest)
      .values({ storeId: auth.storeId, tokenHash, lastReceivedAt: null })
      .onConflictDoUpdate({
        target: storeSmsIngest.storeId,
        set: { tokenHash, lastReceivedAt: null },
      });
    return json({
      connected: true,
      lastReceivedAt: null,
      url: `${appUrl()}/api/stocking/ingest?k=${token}`,
    });
  }

  if (action === 'revoke') {
    await db.delete(storeSmsIngest).where(eq(storeSmsIngest.storeId, auth.storeId));
    return json({ connected: false, lastReceivedAt: null });
  }

  const [row] = await db
    .select({ last: storeSmsIngest.lastReceivedAt })
    .from(storeSmsIngest)
    .where(eq(storeSmsIngest.storeId, auth.storeId))
    .limit(1);
  return json({ connected: !!row, lastReceivedAt: row?.last ? Number(row.last) : null });
}
