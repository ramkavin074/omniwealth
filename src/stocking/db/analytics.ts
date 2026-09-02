// Reports derived entirely from the local movement ledger + product list.
// "Sold" = scan-out movements (a negative delta with reason 'scan-out').

import { db } from './dexie';
import { listProducts } from './products';
import { daysUntil, type Product } from '../types';

const DAY = 24 * 60 * 60 * 1000;

export interface ExpirySoon {
  /** expired first, then ≤7 days, then ≤30 days; each sorted by soonest. */
  buckets: { key: 'expired' | 'd7' | 'd30'; products: Product[] }[];
  /** expired + expiring within 7 days — drives the Home banner. */
  urgent: number;
}

/** Products with stock on hand whose (single) batch date is past or near. */
export async function expiringSoon(): Promise<ExpirySoon> {
  const rows = (await listProducts())
    .filter((p) => p.expiryDate && p.stockQty > 0)
    .map((p) => ({ p, d: daysUntil(p.expiryDate as string) }))
    .filter((x): x is { p: Product; d: number } => x.d !== null)
    .sort((a, b) => a.d - b.d);
  const pick = (lo: number, hi: number) =>
    rows.filter((x) => x.d >= lo && x.d <= hi).map((x) => x.p);
  const expired = rows.filter((x) => x.d < 0).map((x) => x.p);
  return {
    buckets: [
      { key: 'expired', products: expired },
      { key: 'd7', products: pick(0, 7) },
      { key: 'd30', products: pick(8, 30) },
    ],
    urgent: expired.length + pick(0, 7).length,
  };
}

export interface FastMover {
  product: Product;
  unitsSold: number;
  valueSold: number;
}

/** Top sellers over the last `days`, by units sold. */
export async function fastMovers(days = 30, limit = 15): Promise<FastMover[]> {
  const since = Date.now() - days * DAY;
  const [products, movements] = await Promise.all([
    listProducts(),
    db().movements.where('createdAt').above(since).toArray(),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const agg = new Map<string, { units: number; value: number }>();
  for (const m of movements) {
    if (m.reason !== 'scan-out' || m.delta >= 0) continue;
    const p = byId.get(m.productId);
    if (!p) continue;
    const cur = agg.get(m.productId) ?? { units: 0, value: 0 };
    cur.units += -m.delta;
    cur.value += -m.delta * p.price;
    agg.set(m.productId, cur);
  }
  return [...agg.entries()]
    .map(([id, v]) => ({
      product: byId.get(id)!,
      unitsSold: Math.round(v.units * 1000) / 1000,
      valueSold: Math.round(v.value),
    }))
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, limit);
}

export interface DeadStock {
  buckets: { days: number; products: Product[] }[];
}

/** Products with stock on hand that haven't sold in 30 / 60 / 90 days. */
export async function deadStock(): Promise<DeadStock> {
  const now = Date.now();
  const [products, movements] = await Promise.all([
    listProducts(),
    db().movements.toArray(),
  ]);
  const lastSold = new Map<string, number>();
  for (const m of movements) {
    if (m.reason !== 'scan-out' || m.delta >= 0) continue;
    lastSold.set(
      m.productId,
      Math.max(lastSold.get(m.productId) ?? 0, m.createdAt),
    );
  }
  const inStock = products.filter((p) => p.stockQty > 0);
  const mk = (d: number) => ({
    days: d,
    products: inStock
      .filter((p) => (lastSold.get(p.id) ?? 0) < now - d * DAY)
      .sort((a, b) => b.stockQty * b.price - a.stockQty * a.price),
  });
  // 90 ⊃ 60 ⊃ 30 — show them as distinct rings by subtracting.
  const b90 = mk(90).products;
  const b60 = mk(60).products.filter((p) => !b90.includes(p));
  const b30 = mk(30).products.filter(
    (p) => !b90.includes(p) && !b60.includes(p),
  );
  return {
    buckets: [
      { days: 30, products: b30 },
      { days: 60, products: b60 },
      { days: 90, products: b90 },
    ],
  };
}

export interface WriteOffSummary {
  units: number;
  value: number; // Σ qty lost × costPrice (falls back to selling price)
}

/** Damage + expiry write-offs over the last `days`. */
export async function writeOffs(days = 30): Promise<WriteOffSummary> {
  const since = Date.now() - days * DAY;
  const [products, movements] = await Promise.all([
    listProducts(),
    db().movements.where('createdAt').above(since).toArray(),
  ]);
  const cost = new Map(products.map((p) => [p.id, p.costPrice || p.price]));
  let units = 0;
  let value = 0;
  for (const m of movements) {
    if ((m.reason !== 'damage' && m.reason !== 'expiry') || m.delta >= 0) {
      continue;
    }
    units += -m.delta;
    value += -m.delta * (cost.get(m.productId) ?? 0);
  }
  return { units: Math.round(units * 100) / 100, value: Math.round(value) };
}

export interface DailySale {
  date: string; // yyyy-mm-dd (local)
  units: number;
  value: number;
}

/** Units + value sold per day for the last `days` (oldest first). */
export async function dailySales(days = 7): Promise<DailySale[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const [products, movements] = await Promise.all([
    listProducts(),
    db().movements.where('createdAt').above(start.getTime()).toArray(),
  ]);
  const price = new Map(products.map((p) => [p.id, p.price]));
  const rows: DailySale[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    rows.push({ date: d.toISOString().slice(0, 10), units: 0, value: 0 });
  }
  for (const m of movements) {
    if (m.reason !== 'scan-out' || m.delta >= 0) continue;
    const key = new Date(m.createdAt).toISOString().slice(0, 10);
    const row = rows.find((r) => r.date === key);
    if (!row) continue;
    row.units += -m.delta;
    row.value += -m.delta * (price.get(m.productId) ?? 0);
  }
  return rows.map((r) => ({
    ...r,
    units: Math.round(r.units * 100) / 100,
    value: Math.round(r.value),
  }));
}
