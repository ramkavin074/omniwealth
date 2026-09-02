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
  | 'correction' // recount / fixing a data-entry mistake
  | 'count' // physical stock-take — sets counted quantity
  | 'return' // goods sent back to the supplier (credits the payables ledger)
  | 'damage' // written off — breakage / spoilage
  | 'expiry'; // written off — past its date

export const WRITE_OFF_REASONS: MovementReason[] = ['damage', 'expiry'];

export interface Product {
  id: string;
  barcode: string | null;
  name: string;
  mrp: number; // printed Maximum Retail Price, INR (0 = not set)
  price: number; // actual selling rate, INR 2dp (defaults to mrp)
  costPrice: number; // latest purchase cost per unit, INR (0 = not set)
  stockQty: number; // supports decimals for kg / liter
  unit: Unit;
  lowStockThreshold: number;
  expiryDate: string | null; // 'YYYY-MM-DD' local date of the current batch; null = not tracked
  updatedAt: number; // epoch ms
  deletedAt: number | null; // tombstone for sync; null = live
}

export type ExpiryStatus = 'none' | 'ok' | 'soon' | 'expired';

/** Local calendar date as 'YYYY-MM-DD'. */
export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Whole days from local midnight today to local midnight of `dateISO`
 *  (negative = already past). Returns null for an unparseable date. */
export function daysUntil(dateISO: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!m) return null;
  const then = new Date(+m[1], +m[2] - 1, +m[3]).setHours(0, 0, 0, 0);
  const now = new Date().setHours(0, 0, 0, 0);
  return Math.round((then - now) / 86_400_000);
}

export function expiryStatus(
  p: Pick<Product, 'expiryDate'>,
  soonDays = 30,
): ExpiryStatus {
  if (!p.expiryDate) return 'none';
  const d = daysUntil(p.expiryDate);
  if (d === null) return 'none';
  if (d < 0) return 'expired';
  if (d <= soonDays) return 'soon';
  return 'ok';
}

export function marginPct(p: Pick<Product, 'price' | 'costPrice'>): number | null {
  if (p.price <= 0 || p.costPrice <= 0) return null;
  return Math.round(((p.price - p.costPrice) / p.price) * 100);
}

export interface Movement {
  id: string;
  productId: string;
  delta: number; // signed change applied to stockQty
  reason: MovementReason;
  qtyAfter: number; // stockQty immediately after this movement
  unitCost: number | null; // purchase cost/unit on a stock-in; null otherwise
  supplierId: string | null; // set on a stock-in from a known supplier
  userId: string | null; // who made the change (the audit "who")
  note: string | null;
  createdAt: number; // epoch ms
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  updatedAt: number;
  deletedAt: number | null;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  amount: number;
  note: string | null;
  paidAt: number; // epoch ms
  updatedAt: number;
  deletedAt: number | null;
}

export type ProductDraft = Omit<
  Product,
  'id' | 'updatedAt' | 'deletedAt' | 'stockQty' | 'expiryDate'
> & {
  openingStock: number;
  expiryDate?: string | null;
};

export interface BarcodeCacheEntry {
  barcode: string;
  name: string | null;
  brand: string | null;
  found: boolean;
  fetchedAt: number; // epoch ms
}

export function isLowStock(p: Product): boolean {
  return p.deletedAt === null && p.stockQty <= p.lowStockThreshold;
}
