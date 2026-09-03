// Supplier / inward invoices (C5). Each purchase restocks its lines through
// the movement ledger (a `scan-in` per line, ex-GST unit cost) and records
// the invoice's GST as claimable input tax. The amount paid up front is
// mirrored into supplier_payments so the payables ledger stays in one place;
// balance owed = total − paid.

import { db } from './dexie';
import {
  applyMovement,
  createProduct,
  findByBarcode,
  listProducts,
  uuid,
} from './products';
import { createSupplier, listSuppliers, recordPayment } from './suppliers';
import { getGstConfig } from '../settings';
import type { PurchaseImportRow } from '../import';
import {
  purchaseLineTax,
  purchaseLineValue,
  type Product,
  type Purchase,
  type PurchaseLine,
} from '../types';

const q = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function listPurchases(limit = 200): Promise<Purchase[]> {
  const rows = await db()
    .purchases.orderBy('receivedAt')
    .reverse()
    .limit(limit * 2)
    .toArray();
  return rows.filter((p) => p.deletedAt === null).slice(0, limit);
}

export async function getPurchase(id: string): Promise<Purchase | undefined> {
  const p = await db().purchases.get(id);
  return p && p.deletedAt === null ? p : undefined;
}

export async function purchasesForSupplier(
  supplierId: string,
): Promise<Purchase[]> {
  const rows = await db()
    .purchases.where('supplierId')
    .equals(supplierId)
    .toArray();
  return rows
    .filter((p) => p.deletedAt === null)
    .sort((a, b) => b.receivedAt - a.receivedAt);
}

export interface PurchaseLineDraft {
  productId?: string;
  name: string;
  barcode?: string | null;
  qty: number;
  unit?: string;
  costPrice: number; // ex-GST
  gstRate?: number;
}

export interface PurchaseDraft {
  invoiceNo?: string;
  supplierId: string;
  supplierName: string;
  invoiceDate?: string; // 'YYYY-MM-DD'
  lines: PurchaseLineDraft[];
  paid?: number;
  note?: string;
  receivedAt?: number;
}

async function resolveProduct(line: PurchaseLineDraft): Promise<Product> {
  if (line.productId) {
    const p = await db().products.get(line.productId);
    if (p && p.deletedAt === null) return p;
  }
  const name = line.name.trim();
  const hit =
    (line.barcode ? await findByBarcode(line.barcode) : undefined) ??
    (await listProducts()).find(
      (p) => p.name.toLowerCase() === name.toLowerCase(),
    );
  if (hit) return hit;
  return createProduct({
    barcode: line.barcode ?? null,
    name,
    mrp: 0,
    price: 0,
    costPrice: q(line.costPrice),
    openingStock: 0,
    unit: (line.unit || 'piece') as Product['unit'],
    lowStockThreshold: 0,
  });
}

/** Book a supplier invoice: restock every line, record the input GST, and
 *  write any up-front payment. Returns the stored purchase. */
export async function recordPurchase(draft: PurchaseDraft): Promise<Purchase> {
  const now = Date.now();
  const gstEnabled = getGstConfig().enabled;
  const invoiceNo = (draft.invoiceNo ?? '').trim();

  const lines: PurchaseLine[] = [];
  for (const l of draft.lines) {
    const qty = q(l.qty);
    const costPrice = q(Math.max(0, l.costPrice));
    if (!l.name.trim() || qty <= 0) continue;
    const product = await resolveProduct(l);
    await applyMovement({
      productId: product.id,
      reason: 'scan-in',
      delta: qty,
      unitCost: costPrice > 0 ? costPrice : undefined,
      supplierId: draft.supplierId,
      note: invoiceNo ? `invoice ${invoiceNo}` : 'purchase',
    });
    lines.push({
      productId: product.id,
      name: product.name,
      qty,
      unit: product.unit,
      costPrice,
      gstRate: gstEnabled ? Number(l.gstRate) || 0 : 0,
    });
  }
  if (lines.length === 0) throw new Error('Nothing to purchase');

  const subtotal = q(lines.reduce((t, l) => t + purchaseLineValue(l), 0));
  const gstInput = q(
    lines.reduce((t, l) => t + purchaseLineTax(l, gstEnabled), 0),
  );
  const total = q(subtotal + gstInput);
  const paid = q(Math.max(0, Math.min(draft.paid ?? 0, total)));

  const purchase: Purchase = {
    id: uuid(),
    invoiceNo,
    supplierId: draft.supplierId,
    supplierName: draft.supplierName,
    invoiceDate: draft.invoiceDate || new Date(now).toISOString().slice(0, 10),
    lines,
    subtotal,
    gstInput,
    total,
    paid,
    note: draft.note?.trim() || null,
    receivedAt: draft.receivedAt ?? now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await db().purchases.add(purchase);
  if (paid > 0) {
    await recordPayment({
      supplierId: draft.supplierId,
      amount: paid,
      note: invoiceNo ? `invoice ${invoiceNo}` : 'purchase',
      paidAt: purchase.receivedAt,
    });
  }
  return purchase;
}

/** Tombstone a purchase and pull its stock back out (compensating
 *  `correction` movements). A payment already made against it is left as-is
 *  — reverse it from the supplier screen if needed. */
export async function softDeletePurchase(id: string): Promise<void> {
  const now = Date.now();
  const p = await db().purchases.get(id);
  if (!p || p.deletedAt !== null) return;
  for (const l of p.lines) {
    try {
      await applyMovement({
        productId: l.productId,
        reason: 'correction',
        delta: -l.qty,
        note: `void purchase ${p.invoiceNo || p.id.slice(0, 6)}`,
        allowNegative: true,
      });
    } catch {
      /* product gone — skip */
    }
  }
  await db().purchases.update(id, { deletedAt: now, updatedAt: now });
}

// ---- migration import ----

export interface PurchaseImportResult {
  added: number;
  skipped: number;
}

/** Bring a purchase register over from an existing billing app. Rows sharing
 *  an invoice number + supplier become one purchase. Suppliers are matched
 *  by name (created if missing). A purchase whose invoice number already
 *  exists for that supplier is skipped (re-run safe). */
export async function importPurchases(
  rows: PurchaseImportRow[],
): Promise<PurchaseImportResult> {
  const res: PurchaseImportResult = { added: 0, skipped: 0 };

  const groups = new Map<string, PurchaseImportRow[]>();
  let anon = 0;
  for (const r of rows) {
    const key = r.invoiceNo
      ? `${r.invoiceNo.toLowerCase()}|${r.supplierName.toLowerCase()}`
      : ` anon-${anon++}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  const existing = await listSuppliers();
  const byName = new Map(existing.map((s) => [s.name.trim().toLowerCase(), s]));
  const resolveSupplier = async (name: string) => {
    const hit = byName.get(name.trim().toLowerCase());
    if (hit) return hit;
    const created = await createSupplier({ name });
    byName.set(name.trim().toLowerCase(), created);
    return created;
  };

  const livePurchases = (await db().purchases.toArray()).filter(
    (p) => p.deletedAt === null,
  );
  const taken = new Set(
    livePurchases
      .filter((p) => p.invoiceNo)
      .map((p) => `${p.invoiceNo.toLowerCase()}|${p.supplierId}`),
  );

  for (const list of groups.values()) {
    const head = list[0];
    const supplier = await resolveSupplier(head.supplierName);
    if (
      head.invoiceNo &&
      taken.has(`${head.invoiceNo.toLowerCase()}|${supplier.id}`)
    ) {
      res.skipped++;
      continue;
    }
    const receivedAt = head.invoiceDate
      ? new Date(head.invoiceDate + 'T12:00:00').getTime()
      : Date.now();
    await recordPurchase({
      invoiceNo: head.invoiceNo ?? undefined,
      supplierId: supplier.id,
      supplierName: supplier.name,
      invoiceDate: head.invoiceDate ?? undefined,
      receivedAt,
      paid: Math.max(0, ...list.map((r) => r.paid || 0)),
      note: list.map((r) => r.note).find((n) => n) ?? undefined,
      lines: list.map((r) => ({
        name: r.item,
        qty: r.qty,
        costPrice: r.rate,
        gstRate: r.gstRate,
      })),
    });
    if (head.invoiceNo) {
      taken.add(`${head.invoiceNo.toLowerCase()}|${supplier.id}`);
    }
    res.added++;
  }

  return res;
}

export interface PurchasesSummary {
  from: number;
  to: number;
  count: number;
  subtotal: number;
  gstInput: number; // claimable ITC in the period
  total: number;
  unpaid: number; // Σ (total − paid) over the period
}

/** Totals for [from, to) on `receivedAt`. Defaults to the current month. */
export async function purchasesSummary(
  from?: number,
  to?: number,
): Promise<PurchasesSummary> {
  let f = from;
  let t = to;
  if (f === undefined || t === undefined) {
    const d = new Date();
    f = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    t = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  }
  const rows = (
    await db().purchases.where('receivedAt').between(f, t, true, false).toArray()
  ).filter((p) => p.deletedAt === null);

  return {
    from: f,
    to: t,
    count: rows.length,
    subtotal: q(rows.reduce((s, p) => s + p.subtotal, 0)),
    gstInput: q(rows.reduce((s, p) => s + p.gstInput, 0)),
    total: q(rows.reduce((s, p) => s + p.total, 0)),
    unpaid: q(rows.reduce((s, p) => s + Math.max(0, p.total - p.paid), 0)),
  };
}

/** Input tax credit claimable in [from, to) — for the tax module. */
export async function gstInputForPeriod(
  from: number,
  to: number,
): Promise<number> {
  const rows = (
    await db().purchases.where('receivedAt').between(from, to, true, false).toArray()
  ).filter((p) => p.deletedAt === null);
  return q(rows.reduce((s, p) => s + p.gstInput, 0));
}
