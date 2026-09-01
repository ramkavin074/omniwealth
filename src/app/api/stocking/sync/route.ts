import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { stockMovements, stockProducts } from '@/db/schema';
import { resolveStockingAuth } from '@/lib/stockingAuth';
import { corsHeaders, corsPreflight } from '@/lib/stockingCors';

// Offline-first sync for the stocking module.
//   push: client sends rows changed since its cursor
//     - products: upsert, last-write-wins on `updatedAt`
//     - movements: append-only (insert, ignore dup id)
//   pull: server returns rows whose server-assigned `syncedAt` is newer than
//         the client's cursor, scoped to the caller's household.
// The response `now` is the client's next cursor.

export const dynamic = 'force-dynamic';

const MAX_ROWS = 10000;

export function OPTIONS(request: Request) {
  return corsPreflight(request, 'POST, OPTIONS');
}

interface InProduct {
  id: string;
  barcode: string | null;
  name: string;
  mrp: number;
  price: number;
  costPrice: number;
  stockQty: number;
  unit: string;
  lowStockThreshold: number;
  updatedAt: number;
  deletedAt: number | null;
}

interface InMovement {
  id: string;
  productId: string;
  delta: number;
  reason: string;
  qtyAfter: number;
  unitCost: number | null;
  note: string | null;
  createdAt: number;
}

const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'), 'POST, OPTIONS');
  const json = (body: unknown, status: number) =>
    Response.json(body, { status, headers });

  const auth = await resolveStockingAuth(request);
  if (!auth) return json({ error: 'Unauthorized' }, 401);
  const hh = auth.householdId;

  let since = 0;
  let inProducts: InProduct[] = [];
  let inMovements: InMovement[] = [];
  try {
    const body = await request.json();
    since = num(body?.since, 0);
    inProducts = Array.isArray(body?.products) ? body.products : [];
    inMovements = Array.isArray(body?.movements) ? body.movements : [];
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }

  if (inProducts.length + inMovements.length > MAX_ROWS) {
    return json({ error: `Send at most ${MAX_ROWS} rows per sync` }, 413);
  }

  const now = Date.now();
  const syncedAt = new Date(now);

  // ---- push: products (upsert, LWW) ----
  if (inProducts.length) {
    const rows = inProducts
      .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
      .map((p) => ({
        id: p.id,
        householdId: hh,
        barcode: p.barcode ?? null,
        name: p.name,
        mrp: String(num(p.mrp)),
        price: String(num(p.price)),
        costPrice: String(num(p.costPrice)),
        stockQty: String(num(p.stockQty)),
        unit: p.unit || 'piece',
        lowStockThreshold: String(num(p.lowStockThreshold)),
        updatedAt: String(num(p.updatedAt)),
        deletedAt: p.deletedAt == null ? null : String(num(p.deletedAt)),
        syncedAt,
      }));

    if (rows.length) {
      await db
        .insert(stockProducts)
        .values(rows)
        .onConflictDoUpdate({
          target: stockProducts.id,
          set: {
            barcode: sql`excluded.barcode`,
            name: sql`excluded.name`,
            mrp: sql`excluded.mrp`,
            price: sql`excluded.price`,
            costPrice: sql`excluded.cost_price`,
            stockQty: sql`excluded.stock_qty`,
            unit: sql`excluded.unit`,
            lowStockThreshold: sql`excluded.low_stock_threshold`,
            updatedAt: sql`excluded.updated_at`,
            deletedAt: sql`excluded.deleted_at`,
            syncedAt: sql`excluded.synced_at`,
          },
          // Only overwrite an existing row that belongs to this household and
          // is strictly older — cross-household id collisions are ignored.
          setWhere: sql`${stockProducts.householdId} = ${hh} AND ${stockProducts.updatedAt} < excluded.updated_at`,
        });
    }
  }

  // ---- push: movements (append-only) ----
  if (inMovements.length) {
    const rows = inMovements
      .filter(
        (m) =>
          m &&
          typeof m.id === 'string' &&
          typeof m.productId === 'string',
      )
      .map((m) => ({
        id: m.id,
        householdId: hh,
        productId: m.productId,
        // Server-authoritative: the mover is whoever this session belongs to.
        userId: auth.userId,
        delta: String(num(m.delta)),
        reason: m.reason || 'manual',
        qtyAfter: String(num(m.qtyAfter)),
        unitCost:
          m.unitCost == null ? null : String(num(m.unitCost)),
        note: m.note ?? null,
        createdAt: String(num(m.createdAt)),
        syncedAt,
      }));
    if (rows.length) {
      await db
        .insert(stockMovements)
        .values(rows)
        .onConflictDoNothing({ target: stockMovements.id });
    }
  }

  // ---- pull: everything newer than the client cursor ----
  const sinceDate = new Date(since);
  const [pulledProducts, pulledMovements] = await Promise.all([
    db
      .select()
      .from(stockProducts)
      .where(
        and(
          eq(stockProducts.householdId, hh),
          gt(stockProducts.syncedAt, sinceDate),
        ),
      )
      .limit(MAX_ROWS),
    db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.householdId, hh),
          gt(stockMovements.syncedAt, sinceDate),
        ),
      )
      .limit(MAX_ROWS),
  ]);

  return json(
    {
      now,
      products: pulledProducts.map((p) => ({
        id: p.id,
        barcode: p.barcode,
        name: p.name,
        mrp: num(p.mrp),
        price: num(p.price),
        costPrice: num(p.costPrice),
        stockQty: num(p.stockQty),
        unit: p.unit,
        lowStockThreshold: num(p.lowStockThreshold),
        updatedAt: num(p.updatedAt),
        deletedAt: p.deletedAt == null ? null : num(p.deletedAt),
      })),
      movements: pulledMovements.map((m) => ({
        id: m.id,
        productId: m.productId,
        userId: m.userId,
        delta: num(m.delta),
        reason: m.reason,
        qtyAfter: num(m.qtyAfter),
        unitCost: m.unitCost == null ? null : num(m.unitCost),
        note: m.note,
        createdAt: num(m.createdAt),
      })),
    },
    200,
  );
}
