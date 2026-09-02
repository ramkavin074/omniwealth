// IndexedDB schema for the stocking module, via Dexie. This database is the
// on-device source of truth — every read and write on the hot path (scan,
// adjust, search) goes here and never touches the network.

import Dexie, { type Table } from 'dexie';
import type {
  BarcodeCacheEntry,
  HeldSale,
  Movement,
  Product,
  Sale,
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
  sales!: Table<Sale, string>;
  heldSales!: Table<HeldSale, string>;

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
    // v7: billing — sales (bill header + embedded line items).
    this.version(7).stores({
      products: 'id, barcode, name, updatedAt, deletedAt',
      movements: 'id, productId, createdAt',
      barcodeCache: 'barcode, fetchedAt',
      syncState: 'id',
      suppliers: 'id, name, updatedAt, deletedAt',
      supplierPayments: 'id, supplierId, updatedAt',
      sales: 'id, billNo, createdAt, updatedAt',
    });
    // v8: bill-level discount + parked (held) carts. heldSales is local-only.
    this.version(8)
      .stores({
        products: 'id, barcode, name, updatedAt, deletedAt',
        movements: 'id, productId, createdAt',
        barcodeCache: 'barcode, fetchedAt',
        syncState: 'id',
        suppliers: 'id, name, updatedAt, deletedAt',
        supplierPayments: 'id, supplierId, updatedAt',
        sales: 'id, billNo, createdAt, updatedAt',
        heldSales: 'id, createdAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('sales')
          .toCollection()
          .modify((s: Sale) => {
            if (typeof s.discount !== 'number') s.discount = 0;
          });
      });
    // v9: per-product GST rate + HSN; per-sale tax breakup. No index change.
    this.version(9)
      .stores({
        products: 'id, barcode, name, updatedAt, deletedAt',
        movements: 'id, productId, createdAt',
        barcodeCache: 'barcode, fetchedAt',
        syncState: 'id',
        suppliers: 'id, name, updatedAt, deletedAt',
        supplierPayments: 'id, supplierId, updatedAt',
        sales: 'id, billNo, createdAt, updatedAt',
        heldSales: 'id, createdAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('products')
          .toCollection()
          .modify((p: Product) => {
            if (typeof p.gstRate !== 'number') p.gstRate = 0;
            if (p.hsn === undefined) p.hsn = null;
          });
        await tx
          .table('sales')
          .toCollection()
          .modify((s: Sale) => {
            if (typeof s.taxTotal !== 'number') s.taxTotal = 0;
            if (!Array.isArray(s.taxBreakup)) s.taxBreakup = [];
            for (const i of s.items ?? []) {
              if (typeof (i as { gstRate?: number }).gstRate !== 'number') {
                (i as { gstRate: number }).gstRate = 0;
              }
            }
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
