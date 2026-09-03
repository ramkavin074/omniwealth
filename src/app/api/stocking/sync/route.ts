import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  storeCustomers,
  storeExpenses,
  storeOrders,
  storeProducts,
  storePurchases,
  storeReceipts,
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
  roundoff: number;
  total: number;
  refundOf: string | null;
  tenderType: string;
  customerId: string | null;
  cashAmount: number;
  upiAmount: number;
  cardAmount: number;
  salesman: string | null;
  note: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

interface InCustomer {
  id: string;
  name: string;
  phone: string | null;
  place: string | null;
  gstin: string | null;
  creditLimit: number;
  openingBalance: number;
  note: string | null;
  updatedAt: number;
  deletedAt: number | null;
}

interface InReceipt {
  id: string;
  customerId: string;
  amount: number;
  tender: string;
  againstBillId: string | null;
  againstOrderId: string | null;
  note: string | null;
  receivedAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

interface InOrder {
  id: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  lines: unknown;
  total: number;
  advancePaid: number;
  status: string;
  dueDate: string | null;
  note: string | null;
  billId: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

interface InExpense {
  id: string;
  category: string;
  amount: number;
  tender: string;
  payee: string | null;
  note: string | null;
  gstInput: number;
  spentAt: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

interface InPurchase {
  id: string;
  invoiceNo: string;
  supplierId: string;
  supplierName: string;
  invoiceDate: string | null;
  lines: unknown;
  subtotal: number;
  gstInput: number;
  total: number;
  paid: number;
  note: string | null;
  receivedAt: number;
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
  let inCustomers: InCustomer[] = [];
  let inReceipts: InReceipt[] = [];
  let inOrders: InOrder[] = [];
  let inExpenses: InExpense[] = [];
  let inPurchases: InPurchase[] = [];
  try {
    const body = await request.json();
    since = num(body?.since, 0);
    inProducts = Array.isArray(body?.products) ? body.products : [];
    inMovements = Array.isArray(body?.movements) ? body.movements : [];
    inSuppliers = Array.isArray(body?.suppliers) ? body.suppliers : [];
    inPayments = Array.isArray(body?.payments) ? body.payments : [];
    inSales = Array.isArray(body?.sales) ? body.sales : [];
    inUpiReceipts = Array.isArray(body?.upiReceipts) ? body.upiReceipts : [];
    inCustomers = Array.isArray(body?.customers) ? body.customers : [];
    inReceipts = Array.isArray(body?.receipts) ? body.receipts : [];
    inOrders = Array.isArray(body?.orders) ? body.orders : [];
    inExpenses = Array.isArray(body?.expenses) ? body.expenses : [];
    inPurchases = Array.isArray(body?.purchases) ? body.purchases : [];
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }

  const total =
    inProducts.length +
    inMovements.length +
    inSuppliers.length +
    inPayments.length +
    inSales.length +
    inUpiReceipts.length +
    inCustomers.length +
    inReceipts.length +
    inOrders.length +
    inExpenses.length +
    inPurchases.length;
  if (total > MAX_ROWS) {
    return json({ error: `Send at most ${MAX_ROWS} rows per sync` }, 413);
  }

  // Suppliers, the payables ledger, purchases and UPI reconciliation are
  // owner/manager only.
  if (!fullEdit) {
    inSuppliers = [];
    inPayments = [];
    inUpiReceipts = [];
    inPurchases = [];
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
        roundoff: String(num(s.roundoff)),
        total: String(num(s.total)),
        refundOf:
          typeof s.refundOf === 'string' && s.refundOf ? s.refundOf : null,
        tenderType: s.tenderType || 'cash',
        customerId:
          typeof s.customerId === 'string' && s.customerId
            ? s.customerId
            : null,
        cashAmount: String(num(s.cashAmount)),
        upiAmount: String(num(s.upiAmount)),
        cardAmount: String(num(s.cardAmount)),
        salesman:
          typeof s.salesman === 'string' && s.salesman ? s.salesman : null,
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
            customerId: sql`excluded.customer_id`,
            cardAmount: sql`excluded.card_amount`,
            salesman: sql`excluded.salesman`,
            note: sql`excluded.note`,
            updatedAt: sql`excluded.updated_at`,
            deletedAt: sql`excluded.deleted_at`,
            syncedAt: sql`excluded.synced_at`,
          },
          setWhere: sql`${storeSales.storeId} = ${storeId} AND ${storeSales.updatedAt} < excluded.updated_at`,
        });
    }
  }

  // ---- push: customers (upsert, LWW) — credit billing is a counter action ----
  if (inCustomers.length) {
    const rows = inCustomers
      .filter(
        (c) => c && typeof c.id === 'string' && typeof c.name === 'string',
      )
      .map((c) => ({
        id: c.id,
        storeId,
        name: c.name,
        phone: c.phone ?? null,
        place: c.place ?? null,
        gstin: c.gstin ?? null,
        creditLimit: String(num(c.creditLimit)),
        openingBalance: String(num(c.openingBalance)),
        note: c.note ?? null,
        updatedAt: String(num(c.updatedAt)),
        deletedAt: c.deletedAt == null ? null : String(num(c.deletedAt)),
        syncedAt,
      }));
    if (rows.length) {
      await db
        .insert(storeCustomers)
        .values(rows)
        .onConflictDoUpdate({
          target: storeCustomers.id,
          set: {
            name: sql`excluded.name`,
            phone: sql`excluded.phone`,
            place: sql`excluded.place`,
            gstin: sql`excluded.gstin`,
            creditLimit: sql`excluded.credit_limit`,
            openingBalance: sql`excluded.opening_balance`,
            note: sql`excluded.note`,
            updatedAt: sql`excluded.updated_at`,
            deletedAt: sql`excluded.deleted_at`,
            syncedAt: sql`excluded.synced_at`,
          },
          setWhere: sql`${storeCustomers.storeId} = ${storeId} AND ${storeCustomers.updatedAt} < excluded.updated_at`,
        });
    }
  }

  // ---- push: receipts (upsert, LWW) ----
  if (inReceipts.length) {
    const rows = inReceipts
      .filter(
        (r) =>
          r && typeof r.id === 'string' && typeof r.customerId === 'string',
      )
      .map((r) => ({
        id: r.id,
        storeId,
        customerId: r.customerId,
        amount: String(num(r.amount)),
        tender: r.tender === 'upi' ? 'upi' : 'cash',
        againstBillId:
          typeof r.againstBillId === 'string' && r.againstBillId
            ? r.againstBillId
            : null,
        againstOrderId:
          typeof r.againstOrderId === 'string' && r.againstOrderId
            ? r.againstOrderId
            : null,
        note: r.note ?? null,
        receivedAt: String(num(r.receivedAt)),
        updatedAt: String(num(r.updatedAt)),
        deletedAt: r.deletedAt == null ? null : String(num(r.deletedAt)),
        syncedAt,
      }));
    if (rows.length) {
      await db
        .insert(storeReceipts)
        .values(rows)
        .onConflictDoUpdate({
          target: storeReceipts.id,
          set: {
            amount: sql`excluded.amount`,
            tender: sql`excluded.tender`,
            againstBillId: sql`excluded.against_bill_id`,
            againstOrderId: sql`excluded.against_order_id`,
            note: sql`excluded.note`,
            receivedAt: sql`excluded.received_at`,
            updatedAt: sql`excluded.updated_at`,
            deletedAt: sql`excluded.deleted_at`,
            syncedAt: sql`excluded.synced_at`,
          },
          setWhere: sql`${storeReceipts.storeId} = ${storeId} AND ${storeReceipts.updatedAt} < excluded.updated_at`,
        });
    }
  }

  // ---- push: orders (upsert, LWW) — a counter action ----
  if (inOrders.length) {
    const rows = inOrders
      .filter(
        (o) =>
          o && typeof o.id === 'string' && typeof o.customerId === 'string',
      )
      .map((o) => ({
        id: o.id,
        storeId,
        orderNo: String(o.orderNo ?? ''),
        customerId: o.customerId,
        customerName: String(o.customerName ?? ''),
        lines: Array.isArray(o.lines) ? o.lines : [],
        total: String(num(o.total)),
        advancePaid: String(num(o.advancePaid)),
        status: o.status || 'booked',
        dueDate: o.dueDate ?? null,
        note: o.note ?? null,
        billId:
          typeof o.billId === 'string' && o.billId ? o.billId : null,
        createdAt: String(num(o.createdAt)),
        updatedAt: String(num(o.updatedAt)),
        deletedAt: o.deletedAt == null ? null : String(num(o.deletedAt)),
        syncedAt,
      }));
    if (rows.length) {
      await db
        .insert(storeOrders)
        .values(rows)
        .onConflictDoUpdate({
          target: storeOrders.id,
          set: {
            lines: sql`excluded.lines`,
            total: sql`excluded.total`,
            advancePaid: sql`excluded.advance_paid`,
            status: sql`excluded.status`,
            dueDate: sql`excluded.due_date`,
            note: sql`excluded.note`,
            billId: sql`excluded.bill_id`,
            customerName: sql`excluded.customer_name`,
            updatedAt: sql`excluded.updated_at`,
            deletedAt: sql`excluded.deleted_at`,
            syncedAt: sql`excluded.synced_at`,
          },
          setWhere: sql`${storeOrders.storeId} = ${storeId} AND ${storeOrders.updatedAt} < excluded.updated_at`,
        });
    }
  }

  // ---- push: expenses (upsert, LWW) — a counter action ----
  if (inExpenses.length) {
    const rows = inExpenses
      .filter((e) => e && typeof e.id === 'string')
      .map((e) => ({
        id: e.id,
        storeId,
        category: String(e.category || 'other'),
        amount: String(num(e.amount)),
        tender: e.tender === 'upi' ? 'upi' : 'cash',
        payee: e.payee ?? null,
        note: e.note ?? null,
        gstInput: String(num(e.gstInput)),
        spentAt: String(num(e.spentAt)),
        createdAt: String(num(e.createdAt)),
        updatedAt: String(num(e.updatedAt)),
        deletedAt: e.deletedAt == null ? null : String(num(e.deletedAt)),
        syncedAt,
      }));
    if (rows.length) {
      await db
        .insert(storeExpenses)
        .values(rows)
        .onConflictDoUpdate({
          target: storeExpenses.id,
          set: {
            category: sql`excluded.category`,
            amount: sql`excluded.amount`,
            tender: sql`excluded.tender`,
            payee: sql`excluded.payee`,
            note: sql`excluded.note`,
            gstInput: sql`excluded.gst_input`,
            spentAt: sql`excluded.spent_at`,
            updatedAt: sql`excluded.updated_at`,
            deletedAt: sql`excluded.deleted_at`,
            syncedAt: sql`excluded.synced_at`,
          },
          setWhere: sql`${storeExpenses.storeId} = ${storeId} AND ${storeExpenses.updatedAt} < excluded.updated_at`,
        });
    }
  }

  // ---- push: purchases (upsert, LWW) — owner/manager only ----
  if (inPurchases.length) {
    const rows = inPurchases
      .filter(
        (p) =>
          p && typeof p.id === 'string' && typeof p.supplierId === 'string',
      )
      .map((p) => ({
        id: p.id,
        storeId,
        invoiceNo: String(p.invoiceNo ?? ''),
        supplierId: p.supplierId,
        supplierName: String(p.supplierName ?? ''),
        invoiceDate: p.invoiceDate ?? null,
        lines: Array.isArray(p.lines) ? p.lines : [],
        subtotal: String(num(p.subtotal)),
        gstInput: String(num(p.gstInput)),
        total: String(num(p.total)),
        paid: String(num(p.paid)),
        note: p.note ?? null,
        receivedAt: String(num(p.receivedAt)),
        createdAt: String(num(p.createdAt)),
        updatedAt: String(num(p.updatedAt)),
        deletedAt: p.deletedAt == null ? null : String(num(p.deletedAt)),
        syncedAt,
      }));
    if (rows.length) {
      await db
        .insert(storePurchases)
        .values(rows)
        .onConflictDoUpdate({
          target: storePurchases.id,
          set: {
            invoiceNo: sql`excluded.invoice_no`,
            supplierName: sql`excluded.supplier_name`,
            invoiceDate: sql`excluded.invoice_date`,
            lines: sql`excluded.lines`,
            subtotal: sql`excluded.subtotal`,
            gstInput: sql`excluded.gst_input`,
            total: sql`excluded.total`,
            paid: sql`excluded.paid`,
            note: sql`excluded.note`,
            receivedAt: sql`excluded.received_at`,
            updatedAt: sql`excluded.updated_at`,
            deletedAt: sql`excluded.deleted_at`,
            syncedAt: sql`excluded.synced_at`,
          },
          setWhere: sql`${storePurchases.storeId} = ${storeId} AND ${storePurchases.updatedAt} < excluded.updated_at`,
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
    pulledCustomers,
    pulledReceipts,
    pulledOrders,
    pulledExpenses,
    pulledPurchases,
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
        .select()
        .from(storeCustomers)
        .where(
          and(
            eq(storeCustomers.storeId, storeId),
            gt(storeCustomers.syncedAt, sinceDate),
          ),
        )
        .limit(MAX_ROWS),
      db
        .select()
        .from(storeReceipts)
        .where(
          and(
            eq(storeReceipts.storeId, storeId),
            gt(storeReceipts.syncedAt, sinceDate),
          ),
        )
        .limit(MAX_ROWS),
      db
        .select()
        .from(storeOrders)
        .where(
          and(
            eq(storeOrders.storeId, storeId),
            gt(storeOrders.syncedAt, sinceDate),
          ),
        )
        .limit(MAX_ROWS),
      db
        .select()
        .from(storeExpenses)
        .where(
          and(
            eq(storeExpenses.storeId, storeId),
            gt(storeExpenses.syncedAt, sinceDate),
          ),
        )
        .limit(MAX_ROWS),
      db
        .select()
        .from(storePurchases)
        .where(
          and(
            eq(storePurchases.storeId, storeId),
            gt(storePurchases.syncedAt, sinceDate),
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
        roundoff: num(s.roundoff),
        total: num(s.total),
        refundOf: s.refundOf ?? null,
        tenderType: s.tenderType,
        customerId: s.customerId ?? null,
        cashAmount: num(s.cashAmount),
        upiAmount: num(s.upiAmount),
        cardAmount: num(s.cardAmount),
        salesman: s.salesman ?? null,
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
      customers: pulledCustomers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        place: c.place,
        gstin: c.gstin,
        creditLimit: num(c.creditLimit),
        openingBalance: num(c.openingBalance),
        note: c.note,
        updatedAt: num(c.updatedAt),
        deletedAt: c.deletedAt == null ? null : num(c.deletedAt),
      })),
      receipts: pulledReceipts.map((r) => ({
        id: r.id,
        customerId: r.customerId,
        amount: num(r.amount),
        tender: r.tender,
        againstBillId: r.againstBillId ?? null,
        againstOrderId: r.againstOrderId ?? null,
        note: r.note,
        receivedAt: num(r.receivedAt),
        updatedAt: num(r.updatedAt),
        deletedAt: r.deletedAt == null ? null : num(r.deletedAt),
      })),
      orders: pulledOrders.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        customerId: o.customerId,
        customerName: o.customerName,
        lines: Array.isArray(o.lines) ? o.lines : [],
        total: num(o.total),
        advancePaid: num(o.advancePaid),
        status: o.status,
        dueDate: o.dueDate ?? null,
        note: o.note,
        billId: o.billId ?? null,
        createdAt: num(o.createdAt),
        updatedAt: num(o.updatedAt),
        deletedAt: o.deletedAt == null ? null : num(o.deletedAt),
      })),
      expenses: pulledExpenses.map((e) => ({
        id: e.id,
        category: e.category,
        amount: num(e.amount),
        tender: e.tender,
        payee: e.payee,
        note: e.note,
        gstInput: num(e.gstInput),
        spentAt: num(e.spentAt),
        createdAt: num(e.createdAt),
        updatedAt: num(e.updatedAt),
        deletedAt: e.deletedAt == null ? null : num(e.deletedAt),
      })),
      purchases: pulledPurchases.map((p) => ({
        id: p.id,
        invoiceNo: p.invoiceNo,
        supplierId: p.supplierId,
        supplierName: p.supplierName,
        invoiceDate: p.invoiceDate ?? null,
        lines: Array.isArray(p.lines) ? p.lines : [],
        subtotal: num(p.subtotal),
        gstInput: num(p.gstInput),
        total: num(p.total),
        paid: num(p.paid),
        note: p.note,
        receivedAt: num(p.receivedAt),
        createdAt: num(p.createdAt),
        updatedAt: num(p.updatedAt),
        deletedAt: p.deletedAt == null ? null : num(p.deletedAt),
      })),
    },
    200,
  );
}
