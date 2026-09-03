import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { storeProducts, stores } from '@/db/schema';
import ShopScanClient from './ShopScanClient';

// Public customer self-scan page. The shop displays /shop/<storeId> as a QR at
// the entrance. No login. The customer builds a basket and hands it to the
// counter as a QR (offline) or a short code. Prices here are for the shopper's
// running total only — the counter re-prices at billing.

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Self-scan',
  robots: { index: false, follow: false },
};

const NUM = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function Closed({ msg }: { msg: string }) {
  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 420,
        margin: '0 auto',
        padding: '64px 24px',
        textAlign: 'center',
        color: '#334155',
      }}
    >
      <p style={{ fontSize: 15 }}>{msg}</p>
    </main>
  );
}

export default async function ShopPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) {
    return <Closed msg="Shop not found." />;
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
    return <Closed msg="This shop is not set up for self-scan yet." />;
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
      name: r.name,
      barcode: (r.barcode as string).trim(),
      price: NUM(r.price) || NUM(r.mrp),
      unit: r.unit,
    }));

  return (
    <ShopScanClient
      storeId={storeId}
      storeName={s.name}
      upiId={s.upiId ?? null}
      gstInclusive={s.gstInclusive}
      items={items}
    />
  );
}
