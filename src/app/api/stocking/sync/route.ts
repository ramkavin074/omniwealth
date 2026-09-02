import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  storeProducts,
  storeSales,
  storeStockMovements,
  storeUpiReceipts,
  stores,
  supplierPayments,
  suppliers,
} from '@/db/schema';
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
  expiryDate: string | null;
  gstRate: number;
  hsn: string | null;
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
  supplierId: string | null;
  note: string | null;
  createdAt: number;
}

interface InSupplier {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  updatedAt: number;
  deletedAt: number | null;
}

interface InPayment {
  id: string;
  supplierId: string;
  amount: number;
  note: string | null;
  paidAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

interface InUpiReceipt {
  id: string;
  amount: number;
  receivedAt: number;
  ref: string | null;
  payerName: string | null;
  source: string;
  matchedSaleId: string | null;
  note: string | null;
  updatedAt: number;
  deletedAt: number | null;
}

interface InSale {
  id: string;
  billNo: string;
  items: unknown;
  discount: number;
  taxTotal: number;
  taxBreakup: unknown;
  total: number;
  refundOf: string | null;
  tenderType: string;
  cashAmount: number;
  upiAmount: number;
  note: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
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
  let inSuppliers: InSupplier[] = [];
  let inPayments: InPayment[] = [];
  let inSales: InSale[] = [];
  let inUpiReceipts: InUpiReceipt[] = [];
  try {
    const body = await request.json();
    since = num(body?.since, 0);
    inProducts = Array.isArray(body?.products) ? body.products : [];
    inMovements = Array.isArray(body?.movements) ? body.movements : [];
    inSuppliers = Array.isArray(body?.suppliers) ? body.suppliers : [];
    inPayments = Array.isArray(body?.payments) ? body.payments : [];
    inSales = Array.isArray(body?.sales) ? body.sales : [];
    inUpiReceipts = Array.isArray(body?.upiReceipts) ? body.upiReceipts : [];
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }

  const total =
    inProducts.length +
    inMovements.length +
    inSuppliers.length +
    inPayments.length +
    inSales.length +
    inUpiReceipts.length;
  if (total > MAX_ROWS) {
    return json({ error: `Send at most ${MAX_ROWS} rows per sync` }, 413);
  }

  // Suppliers, the payables ledger and UPI reconciliation are owner/manager only.
  if (!fullEdit) {
    inSuppliers = [];
    inPayments = [];
    inUpiReceipts = [];
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
        expiryDate: p.expiryDate || null,
        gstRate: String(num(p.gstRate)),
        hsn: p.hsn || null,
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
            expiryDate: sql`excluded.expiry_date`,
            gstRate: sql`excluded.gst_rate`,
            hsn: sql`excluded.hsn`,
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
        supplierId: m.supplierId ?? null,
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

  // ---- push: suppliers (upsert, LWW) ----
  if (inSuppliers.length) {
    const rows = inSuppliers
      .filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string')
      .map((s) => ({
        id: s.id,
        storeId,
        name: s.name,
        phone: s.phone ?? null,
        note: s.note ?? null,
        updatedAt: String(num(s.updatedAt)),
        deletedAt: s.deletedAt == null ? null : String(num(s.deletedAt)),
        syncedAt,
      }));
    if (rows.length) {
      await db
        .insert(suppliers)
        .values(rows)
        .onConflictDoUpdate({
          target: suppliers.id,
          set: {
            name: sql`excluded.name`,
            phone: sql`excluded.phone`,
            note: sql`excluded.note`,
            updatedAt: sql`excluded.updated_at`,
            deletedAt: sql`excluded.deleted_at`,
            syncedAt: sql`excluded.synced_at`,
          },
          setWhere: sql`${suppliers.storeId} = ${storeId} AND ${suppliers.updatedAt} < excluded.updated_at`,
        });
    }
  }

  // ---- push: supplier payments (upsert, LWW) ----
  if (inPayments.length) {
    const rows = inPayments
      .filter(
        (p) =>
          p && typeof p.id === 'string' && typeof p.supplierId === 'string',
      )
      .map((p) => ({
        id: p.id,
        storeId,
        supplierId: p.supplierId,
        amount: String(num(p.amount)),
        note: p.note ?? null,
        paidAt: String(num(p.paidAt)),
        updatedAt: String(num(p.updatedAt)),
        deletedAt: p.deletedAt == null ? null : String(num(p.deletedAt)),
        syncedAt,
      }));
    if (rows.length) {
      await db
        .insert(supplierPayments)
        .values(rows)
        .onConflictDoUpdate({
          target: supplierPayments.id,
          set: {
            amount: sql`excluded.amount`,
            note: sql`excluded.note`,
            paidAt: sql`excluded.paid_at`,
            updatedAt: sql`excluded.updated_at`,
            deletedAt: sql`excluded.deleted_at`,
            syncedAt: sql`excluded.synced_at`,
          },
          setWhere: sql`${supplierPayments.storeId} = ${storeId} AND ${supplierPayments.updatedAt} < excluded.updated_at`,
        });
    }
  }

  // ---- push: sales (upsert, LWW) — every role can ring up a bill ----
  if (inSales.length) {
    const rows = inSales
      .filter((s) => s && typeof s.id === 'string' && Array.isArray(s.items))
      .map((s) => ({
        id: s.id,
        storeId,
        userId: auth.userId, // server-authoritative
        billNo: String(s.billNo ?? ''),
        items: s.items as unknown[],
        discount: String(num(s.discount)),
        taxTotal: String(num(s.taxTotal)),
        taxBreakup: Array.isArray(s.taxBreakup) ? s.taxBreakup : [],
        total: String(num(s.total)),
        refundOf:
          typeof s.refundOf === 'string' && s.refundOf ? s.refundOf : null,
        tenderType: s.tenderType || 'cash',
        cashAmount: String(num(s.cashAmount)),
        upiAmount: String(num(s.upiAmount)),
        note: s.note ?? null,
        createdAt: String(num(s.createdAt)),
        updatedAt: String(num(s.updatedAt)),
        deletedAt: s.deletedAt == null ? null : String(num(s.deletedAt)),
        syncedAt,
      }));
    if (rows.length) {
      await db
        .insert(storeSales)
        .values(rows)
        .onConflictDoUpdate({
          target: storeSales.id,
          set: {
            note: sql`excluded.note`,
            updatedAt: sql`excluded.updated_at`,
            deletedAt: sql`excluded.deleted_at`,
            syncedAt: sql`excluded.synced_at`,
          },
          setWhere: sql`${storeSales.storeId} = ${storeId} AND ${storeSales.updatedAt} < excluded.updated_at`,
        });
    }
  }

  // ---- push: UPI receipts (upsert, LWW) ----
  if (inUpiReceipts.length) {
    const rows = inUpiReceipts
      .filter((r) => r && typeof r.id === 'string')
      .map((r) => ({
        id: r.id,
        storeId,
        userId: auth.userId,
        amount: String(num(r.amount)),
        receivedAt: String(num(r.receivedAt)),
        ref: r.ref ?? null,
        payerName: r.payerName ?? null,
        source: r.source || 'manual',
        matchedSaleId:
          typeof r.matchedSaleId === 'string' && r.matchedSaleId
            ? r.matchedSaleId
            : null,
        note: r.note ?? null,
        updatedAt: String(num(r.updatedAt)),
        deletedAt: r.deletedAt == null ? null : String(num(r.deletedAt)),
        syncedAt,
      }));
    if (rows.length) {
      await db
        .insert(storeUpiReceipts)
        .values(rows)
        .onConflictDoUpdate({
          target: storeUpiReceipts.id,
          set: {
            amount: sql`excluded.amount`,
            ref: sql`excluded.ref`,
            payerName: sql`excluded.payer_name`,
            source: sql`excluded.source`,
            matchedSaleId: sql`excluded.matched_sale_id`,
            note: sql`excluded.note`,
            updatedAt: sql`excluded.updated_at`,
            deletedAt: sql`excluded.deleted_at`,
            syncedAt: sql`excluded.synced_at`,
          },
          setWhere: sql`${storeUpiReceipts.storeId} = ${storeId} AND ${storeUpiReceipts.updatedAt} < excluded.updated_at`,
        });
    }
  }

  // ---- pull: everything newer than the client cursor ----
  const sinceDate = new Date(since);
  const [
    pulledProducts,
    pulledMovements,
    pulledSuppliers,
    pulledPayments,
    pulledSales,
    pulledUpi,
    storeRow,
  ] = await Promise.all([
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
      db
        .select()
        .from(suppliers)
        .where(
          and(
            eq(suppliers.storeId, storeId),
            gt(suppliers.syncedAt, sinceDate),
          ),
        )
        .limit(MAX_ROWS),
      db
        .select()
        .from(supplierPayments)
        .where(
          and(
            eq(supplierPayments.storeId, storeId),
            gt(supplierPayments.syncedAt, sinceDate),
          ),
        )
        .limit(MAX_ROWS),
      db
        .select()
        .from(storeSales)
        .where(
          and(eq(storeSales.storeId, storeId), gt(storeSales.syncedAt, sinceDate)),
        )
        .limit(MAX_ROWS),
      db
        .select()
        .from(storeUpiReceipts)
        .where(
          and(
            eq(storeUpiReceipts.storeId, storeId),
            gt(storeUpiReceipts.syncedAt, sinceDate),
          ),
        )
        .limit(MAX_ROWS),
      db
        .select({
          gstin: stores.gstin,
          gstEnabled: stores.gstEnabled,
          pricesIncludeTax: stores.pricesIncludeTax,
          defaultGstRate: stores.defaultGstRate,
          gstScheme: stores.gstScheme,
          presumptive: stores.presumptive,
        })
        .from(stores)
        .where(eq(stores.id, storeId))
        .then((r) => r[0]),
    ]);

  return json(
    {
      now,
      role: auth.role,
      store: storeRow
        ? {
            gstin: storeRow.gstin,
            gstEnabled: storeRow.gstEnabled,
            pricesIncludeTax: storeRow.pricesIncludeTax,
            defaultGstRate: num(storeRow.defaultGstRate),
            gstScheme: storeRow.gstScheme,
            presumptive: storeRow.presumptive,
          }
        : null,
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
        expiryDate: p.expiryDate ?? null,
        gstRate: num(p.gstRate),
        hsn: p.hsn ?? null,
        updatedAt: num(p.updatedAt),
        deletedAt: p.deletedAt == null ? null : num(p.deletedAt),
      })),
      movements: pulledMovements.map((m) => ({
        id: m.id,
        productId: m.productId,
        userId: m.userId,
        supplierId: m.supplierId ?? null,
        delta: num(m.delta),
        reason: m.reason,
        qtyAfter: num(m.qtyAfter),
        unitCost: m.unitCost == null ? null : num(m.unitCost),
        note: m.note,
        createdAt: num(m.createdAt),
      })),
      suppliers: pulledSuppliers.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        note: s.note,
        updatedAt: num(s.updatedAt),
        deletedAt: s.deletedAt == null ? null : num(s.deletedAt),
      })),
      payments: pulledPayments.map((p) => ({
        id: p.id,
        supplierId: p.supplierId,
        amount: num(p.amount),
        note: p.note,
        paidAt: num(p.paidAt),
        updatedAt: num(p.updatedAt),
        deletedAt: p.deletedAt == null ? null : num(p.deletedAt),
      })),
      sales: pulledSales.map((s) => ({
        id: s.id,
        billNo: s.billNo,
        userId: s.userId,
        items: Array.isArray(s.items) ? s.items : [],
        discount: num(s.discount),
        taxTotal: num(s.taxTotal),
        taxBreakup: Array.isArray(s.taxBreakup) ? s.taxBreakup : [],
        total: num(s.total),
        refundOf: s.refundOf ?? null,
        tenderType: s.tenderType,
        cashAmount: num(s.cashAmount),
        upiAmount: num(s.upiAmount),
        note: s.note,
        createdAt: num(s.createdAt),
        updatedAt: num(s.updatedAt),
        deletedAt: s.deletedAt == null ? null : num(s.deletedAt),
      })),
      upiReceipts: pulledUpi.map((r) => ({
        id: r.id,
        amount: num(r.amount),
        receivedAt: num(r.receivedAt),
        ref: r.ref,
        payerName: r.payerName,
        source: r.source,
        matchedSaleId: r.matchedSaleId ?? null,
        note: r.note,
        updatedAt: num(r.updatedAt),
        deletedAt: r.deletedAt == null ? null : num(r.deletedAt),
      })),
    },
    200,
  );
}
