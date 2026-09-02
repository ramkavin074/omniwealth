// IndexedDB schema for the stocking module, via Dexie. This database is the
// on-device source of truth — every read and write on the hot path (scan,
// adjust, search) goes here and never touches the network.

import Dexie, { type Table } from 'dexie';
import type {
  BarcodeCacheEntry,
  Movement,
  Product,
  Supplier,
  SupplierPayment,
} from '../types';

export interface SyncStateRow {
  id: 'default';
  /** Server `now` from the last successful sync — the next pull cursor. */
  cursor: number;
  /** Device time of the last successful sync. */
  lastSyncAt: number;
}

export class StockingDB extends Dexie {
  products!: Table<Product, string>;
  movements!: Table<Movement, string>;
  barcodeCache!: Table<BarcodeCacheEntry, string>;
  syncState!: Table<SyncStateRow, string>;
  suppliers!: Table<Supplier, string>;
  supplierPayments!: Table<SupplierPayment, string>;

  constructor() {
    super('stocking');
    // v1: initial schema. Indexes chosen for the three hot queries —
    // barcode lookup, name search/sort, and the low-stock scan.
    this.version(1).stores({
      products: 'id, barcode, name, updatedAt, deletedAt',
      movements: 'id, productId, createdAt',
    });
    // v2: `mrp` added to products (backfilled from `price`); offline cache of
    // online barcode name lookups.
    this.version(2)
      .stores({
        products: 'id, barcode, name, updatedAt, deletedAt',
        movements: 'id, productId, createdAt',
        barcodeCache: 'barcode, fetchedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('products')
          .toCollection()
          .modify((p: Product) => {
            if (typeof p.mrp !== 'number') p.mrp = p.price ?? 0;
          });
      });
    // v3: cloud-sync bookkeeping.
    this.version(3).stores({
      products: 'id, barcode, name, updatedAt, deletedAt',
      movements: 'id, productId, createdAt',
      barcodeCache: 'barcode, fetchedAt',
      syncState: 'id',
    });
    // v4: cost price + movement cost / who. No index changes; backfill nulls.
    this.version(4)
      .stores({
        products: 'id, barcode, name, updatedAt, deletedAt',
        movements: 'id, productId, createdAt',
        barcodeCache: 'barcode, fetchedAt',
        syncState: 'id',
      })
      .upgrade(async (tx) => {
        await tx
          .table('products')
          .toCollection()
          .modify((p: Product) => {
            if (typeof p.costPrice !== 'number') p.costPrice = 0;
          });
        await tx
          .table('movements')
          .toCollection()
          .modify((m: Movement) => {
            if (m.unitCost === undefined) m.unitCost = null;
            if (m.userId === undefined) m.userId = null;
          });
      });
    // v5: suppliers + supplier payments (the supplier ledger).
    this.version(5)
      .stores({
        products: 'id, barcode, name, updatedAt, deletedAt',
        movements: 'id, productId, createdAt',
        barcodeCache: 'barcode, fetchedAt',
        syncState: 'id',
        suppliers: 'id, name, updatedAt, deletedAt',
        supplierPayments: 'id, supplierId, updatedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('movements')
          .toCollection()
          .modify((m: Movement) => {
            if (m.supplierId === undefined) m.supplierId = null;
          });
      });
    // v6: per-product expiry date ('YYYY-MM-DD'). No index change; backfill null.
    this.version(6)
      .stores({
        products: 'id, barcode, name, updatedAt, deletedAt',
        movements: 'id, productId, createdAt',
        barcodeCache: 'barcode, fetchedAt',
        syncState: 'id',
        suppliers: 'id, name, updatedAt, deletedAt',
        supplierPayments: 'id, supplierId, updatedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('products')
          .toCollection()
          .modify((p: Product) => {
            if (p.expiryDate === undefined) p.expiryDate = null;
          });
      });
  }
}

let _db: StockingDB | null = null;

/** Lazily create the singleton. Safe to call during SSR import (never opens
 *  IndexedDB until a query actually runs). */
export function db(): StockingDB {
  if (!_db) _db = new StockingDB();
  return _db;
}
