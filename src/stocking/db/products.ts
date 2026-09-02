// Repository functions for products + stock movements. All writes go through
// here so that every stock change is atomic (product row + movement row in
// one Dexie transaction) and always stamps `updatedAt`.

import { db } from './dexie';
import { getUserId } from '../settings';
import type {
  Movement,
  MovementReason,
  Product,
  ProductDraft,
} from '../types';

export function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older WebViews without crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Round to 3 dp so kg/liter maths doesn't accumulate float dust. */
function q(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export async function findByBarcode(
  barcode: string,
): Promise<Product | undefined> {
  const code = barcode.trim();
  if (!code) return undefined;
  const hits = await db().products.where('barcode').equals(code).toArray();
  return hits.find((p) => p.deletedAt === null);
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const p = await db().products.get(id);
  return p && p.deletedAt === null ? p : undefined;
}

/** All live products, newest-updated first. */
export async function listProducts(): Promise<Product[]> {
  const all = await db().products.orderBy('updatedAt').reverse().toArray();
  return all.filter((p) => p.deletedAt === null);
}

/** Case-insensitive substring match on name or barcode. */
export async function searchProducts(term: string): Promise<Product[]> {
  const live = await listProducts();
  return filterProducts(live, term);
}

export type ProductSort = 'recent' | 'name' | 'low';

/** Pure filter — kept separate so the list screen can run it in a memo over a
 *  single live snapshot instead of re-querying IndexedDB on every keystroke. */
export function filterProducts(list: Product[], term: string): Product[] {
  const q = term.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode ?? '').toLowerCase().includes(q),
  );
}

export function sortProducts(list: Product[], sort: ProductSort): Product[] {
  const copy = list.slice();
  if (sort === 'name') {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'low') {
    // Lowest headroom (stock − threshold) first, then by name.
    copy.sort((a, b) => {
      const ha = a.stockQty - a.lowStockThreshold;
      const hb = b.stockQty - b.lowStockThreshold;
      return ha - hb || a.name.localeCompare(b.name);
    });
  } else {
    copy.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return copy;
}

export async function listLowStock(): Promise<Product[]> {
  const live = await listProducts();
  return live.filter((p) => p.stockQty <= p.lowStockThreshold);
}

/** Create a product from the "not found" quick-add form. Writes an
 *  `opening` movement for the starting quantity. */
export async function createProduct(draft: ProductDraft): Promise<Product> {
  const now = Date.now();
  const mrp = q(draft.mrp);
  const product: Product = {
    id: uuid(),
    barcode: draft.barcode ? draft.barcode.trim() : null,
    name: draft.name.trim(),
    mrp,
    // Selling rate falls back to MRP when left blank.
    price: q(draft.price || draft.mrp),
    costPrice: q(draft.costPrice),
    stockQty: q(draft.openingStock),
    unit: draft.unit,
    lowStockThreshold: q(draft.lowStockThreshold),
    updatedAt: now,
    deletedAt: null,
  };

  await db().transaction('rw', db().products, db().movements, async () => {
    await db().products.add(product);
    if (product.stockQty !== 0) {
      const movement: Movement = {
        id: uuid(),
        productId: product.id,
        delta: product.stockQty,
        reason: 'opening',
        qtyAfter: product.stockQty,
        unitCost: product.costPrice > 0 ? product.costPrice : null,
        supplierId: null,
        userId: getUserId(),
        note: null,
        createdAt: now,
      };
      await db().movements.add(movement);
    }
  });

  return product;
}

/** Patch editable fields (name / mrp / price / unit / threshold / barcode).
 *  Does not touch stockQty — use `applyMovement` for that. */
export async function updateProduct(
  id: string,
  patch: Partial<
    Pick<
      Product,
      | 'name'
      | 'mrp'
      | 'price'
      | 'costPrice'
      | 'unit'
      | 'lowStockThreshold'
      | 'barcode'
    >
  >,
): Promise<void> {
  const clean: Partial<Product> = { updatedAt: Date.now() };
  if (patch.name !== undefined) clean.name = patch.name.trim();
  if (patch.mrp !== undefined) clean.mrp = q(patch.mrp);
  if (patch.price !== undefined) clean.price = q(patch.price);
  if (patch.costPrice !== undefined) clean.costPrice = q(patch.costPrice);
  if (patch.unit !== undefined) clean.unit = patch.unit;
  if (patch.lowStockThreshold !== undefined) {
    clean.lowStockThreshold = q(patch.lowStockThreshold);
  }
  if (patch.barcode !== undefined) {
    clean.barcode = patch.barcode ? patch.barcode.trim() : null;
  }
  await db().products.update(id, clean);
}

/** Cache the result of an online barcode name lookup so a later offline
 *  "not found" scan of the same item can still prefill the name. */
export async function cacheBarcodeLookup(
  entry: import('../types').BarcodeCacheEntry,
): Promise<void> {
  await db().barcodeCache.put(entry);
}

export async function getCachedBarcode(
  barcode: string,
): Promise<import('../types').BarcodeCacheEntry | undefined> {
  return db().barcodeCache.get(barcode.trim());
}

export async function softDeleteProduct(id: string): Promise<void> {
  await db().products.update(id, {
    deletedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

interface MovementInput {
  productId: string;
  reason: MovementReason;
  note?: string | null;
  /** Signed change to apply. Provide this OR `setTo`, not both. */
  delta?: number;
  /** Absolute target quantity. `delta` is derived from current stock. */
  setTo?: number;
  /** Purchase cost/unit on a stock-in — also updates the product's costPrice
   *  (latest-cost model). */
  unitCost?: number | null;
  /** Supplier this stock-in came from. */
  supplierId?: string | null;
}

export interface MovementResult {
  qtyAfter: number;
  movementId: string;
}

/** Apply a stock movement atomically: writes the movement row and updates
 *  the product's stockQty + updatedAt in one transaction. */
export async function applyMovement(
  input: MovementInput,
): Promise<MovementResult> {
  const now = Date.now();
  const movementId = uuid();
  let qtyAfter = 0;

  await db().transaction('rw', db().products, db().movements, async () => {
    const product = await db().products.get(input.productId);
    if (!product || product.deletedAt !== null) {
      throw new Error('Product not found');
    }

    const delta =
      input.setTo !== undefined
        ? q(input.setTo - product.stockQty)
        : q(input.delta ?? 0);

    qtyAfter = q(product.stockQty + delta);
    const unitCost =
      typeof input.unitCost === 'number' && input.unitCost > 0
        ? q(input.unitCost)
        : null;

    const movement: Movement = {
      id: movementId,
      productId: product.id,
      delta,
      reason: input.reason,
      qtyAfter,
      unitCost,
      supplierId: input.supplierId ?? null,
      userId: getUserId(),
      note: input.note?.trim() ? input.note.trim() : null,
      createdAt: now,
    };

    await db().movements.add(movement);
    const patch: Partial<Product> = { stockQty: qtyAfter, updatedAt: now };
    // A stock-in with a cost becomes the product's current cost.
    if (unitCost !== null && delta > 0) patch.costPrice = unitCost;
    await db().products.update(product.id, patch);
  });

  return { qtyAfter, movementId };
}

/** Reverse a movement by appending a compensating one (the ledger stays
 *  append-only). No-op if the movement is already undone or gone. */
export async function undoMovement(movementId: string): Promise<void> {
  const now = Date.now();
  await db().transaction('rw', db().products, db().movements, async () => {
    const orig = await db().movements.get(movementId);
    if (!orig) return;
    const product = await db().products.get(orig.productId);
    if (!product || product.deletedAt !== null) return;

    const qtyAfter = q(product.stockQty - orig.delta);
    await db().movements.add({
      id: uuid(),
      productId: product.id,
      delta: q(-orig.delta),
      reason: 'correction',
      qtyAfter,
      unitCost: null,
      supplierId: null,
      userId: getUserId(),
      note: `undo ${orig.reason}`,
      createdAt: now,
    });
    await db().products.update(product.id, { stockQty: qtyAfter, updatedAt: now });
  });
}

export async function movementsFor(
  productId: string,
  limit = 20,
): Promise<Movement[]> {
  const rows = await db()
    .movements.where('productId')
    .equals(productId)
    .sortBy('createdAt');
  return rows.reverse().slice(0, limit);
}

export interface MovementWithName extends Movement {
  productName: string;
}

/** Most recent movements across the whole catalogue, newest first. */
export async function recentMovements(
  limit = 100,
): Promise<MovementWithName[]> {
  const rows = await db()
    .movements.orderBy('createdAt')
    .reverse()
    .limit(limit)
    .toArray();
  const names = new Map<string, string>();
  for (const p of await db().products.toArray()) names.set(p.id, p.name);
  return rows.map((m) => ({
    ...m,
    productName: names.get(m.productId) ?? '—',
  }));
}

export interface CatalogueStats {
  productCount: number;
  lowCount: number;
  stockValue: number; // Σ price × stockQty (retail)
  stockCost: number; // Σ costPrice × stockQty (for items with a cost set)
  marginValue: number; // Σ (price − costPrice) × stockQty (items with cost)
  movementsToday: number;
}

export async function catalogueStats(): Promise<CatalogueStats> {
  const products = await listProducts();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const movementsToday = await db()
    .movements.where('createdAt')
    .aboveOrEqual(startOfDay.getTime())
    .count();

  let lowCount = 0;
  let stockValue = 0;
  let stockCost = 0;
  let marginValue = 0;
  for (const p of products) {
    if (p.stockQty <= p.lowStockThreshold) lowCount++;
    stockValue += p.price * p.stockQty;
    if (p.costPrice > 0) {
      stockCost += p.costPrice * p.stockQty;
      marginValue += (p.price - p.costPrice) * p.stockQty;
    }
  }
  return {
    productCount: products.length,
    lowCount,
    stockValue: q(stockValue),
    stockCost: q(stockCost),
    marginValue: q(marginValue),
    movementsToday,
  };
}

export interface ImportRow {
  barcode: string | null;
  name: string;
  mrp: number;
  price: number;
  costPrice: number;
  unit: string;
  openingStock: number;
  lowStockThreshold: number;
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
}

/** Bulk upsert a parsed catalogue. Rows with a barcode match an existing
 *  product by barcode; otherwise by exact (case-insensitive) name. Existing
 *  rows get name/mrp/price/unit/threshold updated but their stock is left
 *  alone; new rows are created with an `opening` movement for their stock. */
export async function importProducts(
  rows: ImportRow[],
): Promise<ImportResult> {
  const res: ImportResult = { added: 0, updated: 0, skipped: 0 };
  const now = Date.now();

  await db().transaction('rw', db().products, db().movements, async () => {
    const existing = await db().products.toArray();
    const byBarcode = new Map<string, Product>();
    const byName = new Map<string, Product>();
    for (const p of existing) {
      if (p.deletedAt !== null) continue;
      if (p.barcode) byBarcode.set(p.barcode, p);
      byName.set(p.name.toLowerCase(), p);
    }

    for (const row of rows) {
      const name = row.name.trim();
      if (!name) {
        res.skipped++;
        continue;
      }
      const barcode = row.barcode ? row.barcode.trim() : null;
      const mrp = q(row.mrp);
      const price = q(row.price || row.mrp);
      const costPrice = q(row.costPrice);
      const unit = (row.unit || 'piece').trim();
      const threshold = q(row.lowStockThreshold);

      const match =
        (barcode && byBarcode.get(barcode)) || byName.get(name.toLowerCase());

      if (match) {
        await db().products.update(match.id, {
          name,
          mrp,
          price,
          ...(costPrice > 0 ? { costPrice } : {}),
          unit: unit as Product['unit'],
          lowStockThreshold: threshold,
          barcode: barcode ?? match.barcode,
          updatedAt: now,
        });
        res.updated++;
        continue;
      }

      const product: Product = {
        id: uuid(),
        barcode,
        name,
        mrp,
        price,
        costPrice,
        stockQty: q(row.openingStock),
        unit: unit as Product['unit'],
        lowStockThreshold: threshold,
        updatedAt: now,
        deletedAt: null,
      };
      await db().products.add(product);
      if (product.stockQty !== 0) {
        await db().movements.add({
          id: uuid(),
          productId: product.id,
          delta: product.stockQty,
          reason: 'opening',
          qtyAfter: product.stockQty,
          unitCost: costPrice > 0 ? costPrice : null,
          supplierId: null,
          userId: getUserId(),
          note: 'import',
          createdAt: now,
        });
      }
      if (barcode) byBarcode.set(barcode, product);
      byName.set(name.toLowerCase(), product);
      res.added++;
    }
  });

  return res;
}
