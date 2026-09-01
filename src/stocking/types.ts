// Core domain types for the offline stocking module. These are the shapes
// stored in IndexedDB (via Dexie) — the on-device source of truth. IDs are
// client-generated UUIDs and every row carries `updatedAt` (epoch ms) so a
// later last-write-wins cloud sync is straightforward.

export type Unit =
  | 'piece'
  | 'kg'
  | 'liter'
  | 'packet'
  | 'box'
  | 'dozen';

export const UNITS: Unit[] = [
  'piece',
  'kg',
  'liter',
  'packet',
  'box',
  'dozen',
];

export type MovementReason =
  | 'opening' // initial stock when the product is created
  | 'scan-in' // received / restocked via a barcode scan
  | 'scan-out' // sold / removed via a barcode scan
  | 'manual' // hand-entered adjustment (loose goods, corrections)
  | 'correction'; // recount / fixing a data-entry mistake

export interface Product {
  id: string;
  barcode: string | null;
  name: string;
  price: number; // INR, 2 decimal places
  stockQty: number; // supports decimals for kg / liter
  unit: Unit;
  lowStockThreshold: number;
  updatedAt: number; // epoch ms
  deletedAt: number | null; // tombstone for sync; null = live
}

export interface Movement {
  id: string;
  productId: string;
  delta: number; // signed change applied to stockQty
  reason: MovementReason;
  qtyAfter: number; // stockQty immediately after this movement
  note: string | null;
  createdAt: number; // epoch ms
}

export type ProductDraft = Omit<
  Product,
  'id' | 'updatedAt' | 'deletedAt' | 'stockQty'
> & {
  openingStock: number;
};

export function isLowStock(p: Product): boolean {
  return p.deletedAt === null && p.stockQty <= p.lowStockThreshold;
}
