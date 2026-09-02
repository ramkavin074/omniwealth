import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { storeProducts, storeStockMovements } from '@/db/schema';
import { canEditCatalogue, resolveStockingAuth } from '@/lib/stockingAuth';
import { corsHeaders, corsPreflight } from '@/lib/stockingCors';

// Offline-first sync for the stocking module, scoped to the caller's store.
//   push: rows changed since the client cursor
//     - products: upsert, last-write-wins on `updatedAt`. A `staff` caller can
//       only move stock (stock_qty) — catalogue fields (name/price/cost/…) are
//       kept from the existing row.
//     - movements: append-only (insert, ignore dup id). `user_id` is
//       server-stamped from the session.
//   pull: rows whose server-assigned `synced_at` is newer than the cursor.
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
  const storeId = auth.storeId;
  const fullEdit = canEditCatalogue(auth.role);

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
        storeId,
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
      // owner/manager: full catalogue upsert. staff: only stock_qty moves;
      // a NEW row from staff still lands (they can add a product by scanning),
      // but edits to an existing row keep its catalogue fields.
      const set = fullEdit
        ? {
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
          }
        : {
            stockQty: sql`excluded.stock_qty`,
            updatedAt: sql`excluded.updated_at`,
            syncedAt: sql`excluded.synced_at`,
          };

      await db
        .insert(storeProducts)
        .values(rows)
        .onConflictDoUpdate({
          target: storeProducts.id,
          set,
          // Only overwrite an existing row of THIS store that is strictly
          // older — cross-store id collisions are ignored.
          setWhere: sql`${storeProducts.storeId} = ${storeId} AND ${storeProducts.updatedAt} < excluded.updated_at`,
        });
    }
  }

  // ---- push: movements (append-only) ----
  if (inMovements.length) {
    const rows = inMovements
      .filter(
        (m) =>
          m && typeof m.id === 'string' && typeof m.productId === 'string',
      )
      .map((m) => ({
        id: m.id,
        storeId,
        productId: m.productId,
        userId: auth.userId, // server-authoritative
        delta: String(num(m.delta)),
        reason: m.reason || 'manual',
        qtyAfter: String(num(m.qtyAfter)),
        unitCost: m.unitCost == null ? null : String(num(m.unitCost)),
        note: m.note ?? null,
        createdAt: String(num(m.createdAt)),
        syncedAt,
      }));
    if (rows.length) {
      await db
        .insert(storeStockMovements)
        .values(rows)
        .onConflictDoNothing({ target: storeStockMovements.id });
    }
  }

  // ---- pull: everything newer than the client cursor ----
  const sinceDate = new Date(since);
  const [pulledProducts, pulledMovements] = await Promise.all([
    db
      .select()
      .from(storeProducts)
      .where(
        and(
          eq(storeProducts.storeId, storeId),
          gt(storeProducts.syncedAt, sinceDate),
        ),
      )
      .limit(MAX_ROWS),
    db
      .select()
      .from(storeStockMovements)
      .where(
        and(
          eq(storeStockMovements.storeId, storeId),
          gt(storeStockMovements.syncedAt, sinceDate),
        ),
      )
      .limit(MAX_ROWS),
  ]);

  return json(
    {
      now,
      role: auth.role,
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
