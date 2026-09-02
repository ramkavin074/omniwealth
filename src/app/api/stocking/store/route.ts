import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { stores } from '@/db/schema';
import { canEditCatalogue, resolveStockingAuth } from '@/lib/stockingAuth';
import { corsHeaders, corsPreflight } from '@/lib/stockingCors';

// Per-store settings the client can't sync as rows. Currently just the
// low-stock WhatsApp alert phone. Owner/manager only for writes.

export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return corsPreflight(request, 'GET, POST, OPTIONS');
}

export async function GET(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'), 'GET, POST, OPTIONS');
  const auth = await resolveStockingAuth(request);
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  const [s] = await db
    .select({ name: stores.name, alertPhone: stores.alertPhone })
    .from(stores)
    .where(eq(stores.id, auth.storeId));
  return Response.json({ store: s ?? null }, { headers });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'), 'GET, POST, OPTIONS');
  const auth = await resolveStockingAuth(request);
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  if (!canEditCatalogue(auth.role)) {
    return Response.json({ error: 'Not permitted' }, { status: 403, headers });
  }
  let alertPhone: string | null = null;
  try {
    const raw = String((await request.json())?.alertPhone ?? '').trim();
    alertPhone = raw ? raw.replace(/[^\d+]/g, '') : null;
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400, headers });
  }
  await db
    .update(stores)
    .set({ alertPhone })
    .where(eq(stores.id, auth.storeId));
  return Response.json({ ok: true, alertPhone }, { headers });
}
