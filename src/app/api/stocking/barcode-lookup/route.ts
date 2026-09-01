import { corsHeaders, corsPreflight } from '@/lib/stockingCors';

// Best-effort online lookup of a product *name* from a barcode, for the
// stocking app's "not found" quick-add. Price / MRP are never available from
// these sources and stay manual. Open Food Facts covers most packaged
// FMCG / grocery items and needs no API key. Offline or no match → the app
// falls back to manual entry.

export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return corsPreflight(request, 'GET, OPTIONS');
}

interface OffProduct {
  product_name?: string;
  product_name_en?: string;
  brands?: string;
}

export async function GET(request: Request) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin, 'GET, OPTIONS');

  const code = new URL(request.url).searchParams.get('code')?.trim() ?? '';
  if (!/^\d{6,14}$/.test(code)) {
    return Response.json(
      { error: 'A numeric barcode (6–14 digits) is required.' },
      { status: 400, headers },
    );
  }

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_en,brands`,
      {
        headers: { 'User-Agent': 'OmniWealth-Stocking/1.0 (+omniwealth.org)' },
        signal: AbortSignal.timeout(6000),
      },
    );

    if (res.status === 404) {
      return Response.json({ found: false }, { headers });
    }
    if (!res.ok) {
      return Response.json(
        { found: false, error: 'lookup service unavailable' },
        { status: 502, headers },
      );
    }

    const data = (await res.json()) as {
      status?: number;
      product?: OffProduct;
    };
    const p = data.product;
    const name = (p?.product_name || p?.product_name_en || '').trim();
    const brand = (p?.brands || '').split(',')[0]?.trim() || null;

    if (data.status !== 1 || !name) {
      return Response.json({ found: false }, { headers });
    }

    return Response.json({ found: true, name, brand }, { headers });
  } catch {
    return Response.json(
      { found: false, error: 'lookup failed' },
      { status: 504, headers },
    );
  }
}
