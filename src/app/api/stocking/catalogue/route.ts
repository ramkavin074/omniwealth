import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { storeProducts, stores } from '@/db/schema';

// Public, read-only product list for the customer self-scan page
// (/shop/<storeId>). Names + selling price + barcode only — no cost, no
// stock, no margin. 404 unless the store has self-scan switched on.

export const dynamic = 'force-dynamic';

const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export async function GET(request: Request) {
  const storeId = new URL(request.url).searchParams.get('store') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) {
    return Response.json({ error: 'Unknown shop' }, { status: 404 });
  }

  const [s] = await db
    .select({
      name: stores.name,
      status: stores.status,
      selfScan: stores.selfScanEnabled,
      gstInclusive: stores.pricesIncludeTax,
      upiId: stores.upiId,
    })
    .from(stores)
    .where(eq(stores.id, storeId));

  if (!s || s.status === 'suspended' || !s.selfScan) {
    return Response.json({ error: 'Self-scan is not enabled here' }, { status: 404 });
  }

  const rows = await db
    .select({
      id: storeProducts.id,
      name: storeProducts.name,
      barcode: storeProducts.barcode,
      price: storeProducts.price,
      mrp: storeProducts.mrp,
      unit: storeProducts.unit,
    })
    .from(storeProducts)
    .where(
      and(
        eq(storeProducts.storeId, storeId),
        isNull(storeProducts.deletedAt),
        isNotNull(storeProducts.barcode),
      ),
    )
    .limit(4000);

  const items = rows
    .filter((r) => r.barcode && r.barcode.trim())
    .map((r) => ({
      id: r.id,
      name: r.name,
      barcode: (r.barcode as string).trim(),
      price: num(r.price) || num(r.mrp),
      unit: r.unit,
    }));

  return Response.json(
    {
      storeName: s.name,
      gstInclusive: s.gstInclusive,
      upiId: s.upiId ?? null,
      items,
    },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  );
}
