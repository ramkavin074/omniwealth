// IndexedDB schema for the stocking module, via Dexie. This database is the
// on-device source of truth — every read and write on the hot path (scan,
// adjust, search) goes here and never touches the network.

import Dexie, { type Table } from 'dexie';
import type { Movement, Product } from '../types';

export class StockingDB extends Dexie {
  products!: Table<Product, string>;
  movements!: Table<Movement, string>;

  constructor() {
    super('stocking');
    // v1: initial schema. Indexes chosen for the three hot queries —
    // barcode lookup, name search/sort, and the low-stock scan.
    this.version(1).stores({
      products: 'id, barcode, name, updatedAt, deletedAt',
      movements: 'id, productId, createdAt',
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
