import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { stores } from '@/db/schema';
import { canEditCatalogue, resolveStockingAuth } from '@/lib/stockingAuth';
import { corsHeaders, corsPreflight } from '@/lib/stockingCors';

// Per-store settings the client can't sync as rows: the low-stock WhatsApp
// alert phone and the GST setup. Owner/manager only for writes; the sync
// response also echoes the GST fields so the app has them offline.

export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return corsPreflight(request, 'GET, POST, OPTIONS');
}

export async function GET(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'), 'GET, POST, OPTIONS');
  const auth = await resolveStockingAuth(request);
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  const [s] = await db
    .select({
      name: stores.name,
      alertPhone: stores.alertPhone,
      gstin: stores.gstin,
      gstEnabled: stores.gstEnabled,
      pricesIncludeTax: stores.pricesIncludeTax,
      defaultGstRate: stores.defaultGstRate,
    })
    .from(stores)
    .where(eq(stores.id, auth.storeId));
  return Response.json(
    {
      store: s
        ? { ...s, defaultGstRate: Number(s.defaultGstRate) }
        : null,
    },
    { headers },
  );
}

export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'), 'GET, POST, OPTIONS');
  const auth = await resolveStockingAuth(request);
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  if (!canEditCatalogue(auth.role)) {
    return Response.json({ error: 'Not permitted' }, { status: 403, headers });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400, headers });
  }

  const patch: Record<string, unknown> = {};
  if ('alertPhone' in body) {
    const raw = String(body.alertPhone ?? '').trim();
    patch.alertPhone = raw ? raw.replace(/[^\d+]/g, '') : null;
  }
  if ('gstin' in body) {
    const raw = String(body.gstin ?? '')
      .trim()
      .toUpperCase();
    patch.gstin = raw || null;
  }
  if ('gstEnabled' in body) patch.gstEnabled = !!body.gstEnabled;
  if ('pricesIncludeTax' in body) {
    patch.pricesIncludeTax = !!body.pricesIncludeTax;
  }
  if ('defaultGstRate' in body) {
    const n = Number(body.defaultGstRate);
    patch.defaultGstRate = String(Number.isFinite(n) && n >= 0 ? n : 0);
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'Nothing to update' }, { status: 400, headers });
  }

  await db.update(stores).set(patch).where(eq(stores.id, auth.storeId));

  const [s] = await db
    .select({
      name: stores.name,
      alertPhone: stores.alertPhone,
      gstin: stores.gstin,
      gstEnabled: stores.gstEnabled,
      pricesIncludeTax: stores.pricesIncludeTax,
      defaultGstRate: stores.defaultGstRate,
    })
    .from(stores)
    .where(eq(stores.id, auth.storeId));
  return Response.json(
    { ok: true, store: { ...s, defaultGstRate: Number(s.defaultGstRate) } },
    { headers },
  );
}
