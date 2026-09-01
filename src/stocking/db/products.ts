// Repository functions for products + stock movements. All writes go through
// here so that every stock change is atomic (product row + movement row in
// one Dexie transaction) and always stamps `updatedAt`.

import { db } from './dexie';
import type {
  Movement,
  MovementReason,
  Product,
  ProductDraft,
} from '../types';

function uuid(): string {
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
  const q = term.trim().toLowerCase();
  if (!q) return live;
  return live.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode ?? '').toLowerCase().includes(q),
  );
}

export async function listLowStock(): Promise<Product[]> {
  const live = await listProducts();
  return live.filter((p) => p.stockQty <= p.lowStockThreshold);
}

/** Create a product from the "not found" quick-add form. Writes an
 *  `opening` movement for the starting quantity. */
export async function createProduct(draft: ProductDraft): Promise<Product> {
  const now = Date.now();
  const product: Product = {
    id: uuid(),
    barcode: draft.barcode ? draft.barcode.trim() : null,
    name: draft.name.trim(),
    price: q(draft.price),
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
        note: null,
        createdAt: now,
      };
      await db().movements.add(movement);
    }
  });

  return product;
}

/** Patch editable fields (name / price / unit / threshold / barcode). Does
 *  not touch stockQty — use `applyMovement` for that. */
export async function updateProduct(
  id: string,
  patch: Partial<
    Pick<
      Product,
      'name' | 'price' | 'unit' | 'lowStockThreshold' | 'barcode'
    >
  >,
): Promise<void> {
  const clean: Partial<Product> = { updatedAt: Date.now() };
  if (patch.name !== undefined) clean.name = patch.name.trim();
  if (patch.price !== undefined) clean.price = q(patch.price);
  if (patch.unit !== undefined) clean.unit = patch.unit;
  if (patch.lowStockThreshold !== undefined) {
    clean.lowStockThreshold = q(patch.lowStockThreshold);
  }
  if (patch.barcode !== undefined) {
    clean.barcode = patch.barcode ? patch.barcode.trim() : null;
  }
  await db().products.update(id, clean);
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
}

/** Apply a stock movement atomically: writes the movement row and updates
 *  the product's stockQty + updatedAt in one transaction. Returns the new
 *  stock quantity. */
export async function applyMovement(
  input: MovementInput,
): Promise<number> {
  const now = Date.now();
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

    const movement: Movement = {
      id: uuid(),
      productId: product.id,
      delta,
      reason: input.reason,
      qtyAfter,
      note: input.note?.trim() ? input.note.trim() : null,
      createdAt: now,
    };

    await db().movements.add(movement);
    await db().products.update(product.id, {
      stockQty: qtyAfter,
      updatedAt: now,
    });
  });

  return qtyAfter;
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
