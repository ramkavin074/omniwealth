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
  | 'sale-return' // a customer returned goods — back into stock
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
  gstRate: number; // GST %, e.g. 0 / 5 / 12 / 18 / 28
  hsn: string | null; // HSN code (optional, shown on a tax invoice)
  updatedAt: number; // epoch ms
  deletedAt: number | null; // tombstone for sync; null = live
}

export const GST_RATES = [0, 5, 12, 18, 28] as const;

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

// ---- customers & credit (C1) ----

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  place: string | null; // area / village / landmark
  gstin: string | null; // optional — for a B2B customer
  creditLimit: number; // ₹; 0 = no limit set
  openingBalance: number; // ₹ they already owed when added (+ve = owes the shop)
  note: string | null;
  updatedAt: number;
  deletedAt: number | null;
}

export type ReceiptTender = 'cash' | 'upi';

/** Money received from a customer — against their credit balance, or as an
 *  advance/part-payment on an order. */
export interface Receipt {
  id: string;
  customerId: string;
  amount: number; // ₹ received (positive)
  tender: ReceiptTender;
  againstBillId: string | null; // optional — the credit bill this clears
  againstOrderId: string | null; // optional — the order this is an advance on
  note: string | null;
  receivedAt: number; // epoch ms, client clock
  updatedAt: number;
  deletedAt: number | null;
}

// ---- orders / job-work (C2) ----

export type OrderStatus =
  | 'booked'
  | 'in_progress'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export const OPEN_ORDER_STATUSES: OrderStatus[] = [
  'booked',
  'in_progress',
  'ready',
];

export interface OrderLine {
  description: string; // free text — "500 wedding cards, gold foil, design 12"
  qty: number;
  rate: number; // ₹ per unit agreed
}

/** An advance-booked job: taken now, delivered later, balance on collection. */
export interface Order {
  id: string;
  orderNo: string; // per-device, e.g. "K7-O-0007"
  customerId: string;
  customerName: string; // snapshot at booking
  lines: OrderLine[];
  total: number; // Σ qty × rate (the agreed price)
  advancePaid: number; // ₹ received so far (booking advance + part-payments)
  status: OrderStatus;
  dueDate: string | null; // 'YYYY-MM-DD' promised delivery
  note: string | null;
  billId: string | null; // the Sale created when the order was delivered
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export function orderLineTotal(l: OrderLine): number {
  return Math.round(l.qty * l.rate * 100) / 100;
}

export function orderBalance(o: Pick<Order, 'total' | 'advancePaid'>): number {
  return Math.round((o.total - o.advancePaid) * 100) / 100;
}

/** A customer's current balance and how it compares to their limit. */
export interface CustomerBalance {
  customerId: string;
  balance: number; // ₹ owed to the shop (negative = shop owes them / advance)
  overLimit: boolean; // creditLimit > 0 && balance > creditLimit
}

export type ProductDraft = Omit<
  Product,
  | 'id'
  | 'updatedAt'
  | 'deletedAt'
  | 'stockQty'
  | 'expiryDate'
  | 'gstRate'
  | 'hsn'
> & {
  openingStock: number;
  expiryDate?: string | null;
  gstRate?: number;
  hsn?: string | null;
};

// ---- billing (B1) ----

export type TenderType = 'cash' | 'upi' | 'card' | 'split' | 'credit';

export interface SaleItem {
  productId: string;
  name: string; // snapshot at sale time — survives a later rename/delete
  qty: number;
  unit: Unit;
  unitPrice: number; // ₹ per unit actually charged (editable at the counter)
  discount: number; // ₹ off this line (0 = none); applied before bill discount
  discountPct: number; // % it was entered as (0 = entered in ₹ / none) — a display hint; `discount` is authoritative
  gstRate: number; // GST % snapshot (0 when the store isn't charging GST)
}

/** One GST-rate group on a bill's tax summary. cgst === sgst (intra-state). */
export interface TaxRow {
  rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
}

export interface GstConfig {
  enabled: boolean; // charge / show GST on bills
  inclusive: boolean; // true = prices already include GST (kirana norm)
  gstin: string | null; // the shop's GSTIN; presence ⇒ "TAX INVOICE" header
  defaultRate: number; // fallback slab for items with no rate set
}

export const GST_CONFIG_FALLBACK: GstConfig = {
  enabled: false,
  inclusive: true,
  gstin: null,
  defaultRate: 0,
};

export type GstScheme = 'regular' | 'composition';

export interface TaxConfig {
  gstScheme: GstScheme; // only meaningful when GST is enabled
  presumptive: boolean; // income tax under s.44AD
}

export const TAX_CONFIG_FALLBACK: TaxConfig = {
  gstScheme: 'regular',
  presumptive: true,
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Tax breakdown for a set of priced lines. `discount` (₹ off the whole bill)
 *  is spread across lines pro-rata before tax. Inclusive: tax is extracted
 *  from the price. Exclusive: tax is added on top (`addToTotal`). */
export function computeSaleTax(
  lines: { lineTotal: number; gstRate: number }[],
  discount: number,
  cfg: Pick<GstConfig, 'enabled' | 'inclusive'>,
): { taxTotal: number; addToTotal: number; breakup: TaxRow[] } {
  const subtotal = lines.reduce((t, l) => t + l.lineTotal, 0);
  if (!cfg.enabled || subtotal <= 0) {
    return { taxTotal: 0, addToTotal: 0, breakup: [] };
  }
  const disc = Math.min(Math.max(0, discount), subtotal);
  const byRate = new Map<number, { taxable: number; tax: number }>();
  for (const l of lines) {
    const rate = l.gstRate || 0;
    if (rate <= 0) continue;
    const net = l.lineTotal - (disc * l.lineTotal) / subtotal;
    const taxable = cfg.inclusive ? net / (1 + rate / 100) : net;
    const tax = cfg.inclusive ? net - taxable : net * (rate / 100);
    const cur = byRate.get(rate) ?? { taxable: 0, tax: 0 };
    cur.taxable += taxable;
    cur.tax += tax;
    byRate.set(rate, cur);
  }
  const breakup: TaxRow[] = [...byRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, v]) => ({
      rate,
      taxable: r2(v.taxable),
      cgst: r2(v.tax / 2),
      sgst: r2(v.tax / 2),
    }));
  const taxTotal = r2(breakup.reduce((t, b) => t + b.cgst + b.sgst, 0));
  return {
    taxTotal,
    addToTotal: cfg.inclusive ? 0 : taxTotal,
    breakup,
  };
}

export interface Sale {
  id: string;
  billNo: string; // per-device, e.g. "K7-0042"
  createdAt: number; // epoch ms
  userId: string | null; // who rang it up (server-stamped on sync)
  items: SaleItem[]; // empty for a quick amount-only sale; negative qty on a refund
  discount: number; // ₹ taken off the whole bill (0 = none)
  taxTotal: number; // GST on the bill (0 when the store isn't charging GST)
  taxBreakup: TaxRow[]; // per-rate CGST/SGST split for the receipt
  roundoff: number; // ± adjustment applied to reach a round total (already included in `total`)
  total: number; // items − discount (+ taxTotal when tax-exclusive) + roundoff; negative on a refund
  refundOf: string | null; // the original sale's id when this row is a refund
  tenderType: TenderType;
  customerId: string | null; // set on a credit sale (and any sale attributed to a known customer)
  cashAmount: number; // amount taken as cash (= total for a cash sale; 0 on credit)
  upiAmount: number; // amount taken as UPI (0 on credit)
  cardAmount: number; // amount taken on a card / swipe machine (0 on credit)
  salesman: string | null; // free-text name of who made the sale (commission / performance)
  note: string | null;
  updatedAt: number; // epoch ms — LWW for sync / void
  deletedAt: number | null; // set when the bill is voided
}

/** What a line contributes to the bill: qty × price, less this line's own
 *  discount. Never negative. (Refund lines carry a negative qty — the sign
 *  falls out of qty × price and the discount is 0 on those.) */
export function saleLineTotal(i: SaleItem): number {
  const gross = i.qty * i.unitPrice;
  const net = gross >= 0 ? Math.max(0, gross - (i.discount ?? 0)) : gross;
  return Math.round(net * 100) / 100;
}

export function saleSubtotal(s: Pick<Sale, 'items' | 'total' | 'discount'>): number {
  const fromItems = s.items.reduce((t, i) => t + saleLineTotal(i), 0);
  return Math.round((fromItems || s.total + s.discount) * 100) / 100;
}

/** A cart set aside mid-transaction. Local + per-device — never synced. */
export interface HeldSale {
  id: string;
  createdAt: number;
  label: string; // free text the shopkeeper types, or a short auto label
  items: SaleItem[];
  discount: number;
}

// ---- UPI reconciliation (R23) ----

export type UpiSource = 'manual' | 'photo' | 'notification' | 'sms' | 'api';

/** Money the shop actually received over UPI — from a scanned/typed history
 *  now, from a notification listener later. Matched against `upi`/`split`
 *  sales by amount + time. */
export interface UpiReceipt {
  id: string;
  amount: number;
  receivedAt: number; // epoch ms
  ref: string | null; // UPI txn ref / UTR
  payerName: string | null;
  source: UpiSource;
  matchedSaleId: string | null; // the bill this receipt was reconciled to
  note: string | null;
  updatedAt: number;
  deletedAt: number | null;
}

// ---- purchases (C5) ----

export interface PurchaseLine {
  productId: string; // the stock item this line restocks
  name: string; // snapshot at purchase time
  qty: number;
  unit: Unit;
  costPrice: number; // ₹ per unit, EX-GST (the taxable value)
  gstRate: number; // GST % on this line (0 when not registered)
}

/** A supplier's purchase / inward invoice. Its lines add stock (a `scan-in`
 *  movement each, ex-GST unitCost) and its GST portion is the shop's input
 *  tax credit for the period. Balance owed = total − paid; the paid part is
 *  written as a supplier payment so the payables ledger stays in one place. */
export interface Purchase {
  id: string;
  invoiceNo: string; // the SUPPLIER's invoice number (free text)
  supplierId: string;
  supplierName: string; // snapshot
  invoiceDate: string; // 'YYYY-MM-DD'
  lines: PurchaseLine[];
  subtotal: number; // Σ qty × costPrice (ex-GST)
  gstInput: number; // Σ CGST + SGST on the invoice (claimable ITC)
  total: number; // subtotal + gstInput (invoice value)
  paid: number; // ₹ paid at entry (0 = fully on credit)
  note: string | null;
  receivedAt: number; // epoch ms — when the goods came in
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export function purchaseLineValue(l: Pick<PurchaseLine, 'qty' | 'costPrice'>): number {
  return Math.round(l.qty * l.costPrice * 100) / 100;
}

/** CGST + SGST on one line (intra-state; supplier invoices are tax-exclusive). */
export function purchaseLineTax(
  l: Pick<PurchaseLine, 'qty' | 'costPrice' | 'gstRate'>,
  gstEnabled: boolean,
): number {
  if (!gstEnabled || !l.gstRate) return 0;
  return Math.round(l.qty * l.costPrice * (l.gstRate / 100) * 100) / 100;
}

export function purchaseBalance(p: Pick<Purchase, 'total' | 'paid'>): number {
  return Math.round((p.total - p.paid) * 100) / 100;
}

// ---- expenses (C3) ----

export type ExpenseTender = 'cash' | 'upi';

/** Shop running costs — NOT stock purchases (those are supplier payments). */
export type ExpenseCategory =
  | 'rent'
  | 'electricity'
  | 'salary'
  | 'transport'
  | 'supplies' // packing, stationery, cleaning
  | 'refreshments' // tea, snacks
  | 'repairs'
  | 'communication' // phone, internet, recharge
  | 'bank' // charges, fees
  | 'tax' // GST / income-tax paid out
  | 'rent_equipment' // hired machine / generator
  | 'other';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'rent',
  'electricity',
  'salary',
  'transport',
  'supplies',
  'refreshments',
  'repairs',
  'communication',
  'bank',
  'tax',
  'rent_equipment',
  'other',
];

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number; // ₹ paid out
  tender: ExpenseTender;
  payee: string | null; // who was paid (landlord, EB, staff name…)
  note: string | null;
  gstInput: number; // ITC claimable on this expense (0 = none / not registered)
  spentAt: number; // epoch ms — the date the money went out
  createdAt: number;
  updatedAt: number; // LWW for sync
  deletedAt: number | null; // tombstone
}

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
