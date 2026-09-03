// Reports derived entirely from the local movement ledger + product list.
// "Sold" = scan-out movements (a negative delta with reason 'scan-out').

import { db } from './dexie';
import { listProducts } from './products';
import { listSuppliers } from './suppliers';
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

export interface ReorderSuggestion {
  product: Product;
  perDay: number; // units sold per day over the window
  daysLeft: number; // stockQty / perDay
  suggestQty: number; // units to buy to reach the cover target
  supplierId: string | null; // most recent stock-in supplier
  supplierName: string | null;
  supplierPhone: string | null;
}

/**
 * What to reorder: items whose remaining cover (stock ÷ recent sales velocity)
 * is below `coverTargetDays`. `suggestQty` tops each back up to the target.
 * Sorted most-urgent first. Items that haven't sold in the window are skipped.
 */
export async function reorderSuggestions(
  windowDays = 30,
  coverTargetDays = 21,
): Promise<ReorderSuggestion[]> {
  const since = Date.now() - windowDays * DAY;
  const [products, movements, suppliers] = await Promise.all([
    listProducts(),
    db().movements.where('createdAt').above(since).toArray(),
    listSuppliers(),
  ]);
  const supById = new Map(suppliers.map((s) => [s.id, s]));

  const sold = new Map<string, number>();
  const lastIn = new Map<string, { at: number; supplierId: string | null }>();
  // A stock-in older than the window still tells us who last supplied it.
  const allMovements = await db().movements.toArray();
  for (const m of allMovements) {
    if (m.delta > 0 && (m.reason === 'scan-in' || m.reason === 'opening')) {
      const cur = lastIn.get(m.productId);
      if (!cur || m.createdAt > cur.at) {
        lastIn.set(m.productId, {
          at: m.createdAt,
          supplierId: m.supplierId ?? null,
        });
      }
    }
  }
  for (const m of movements) {
    if (m.reason === 'scan-out' && m.delta < 0) {
      sold.set(m.productId, (sold.get(m.productId) ?? 0) + -m.delta);
    }
  }

  const out: ReorderSuggestion[] = [];
  for (const p of products) {
    const units = sold.get(p.id) ?? 0;
    if (units <= 0) continue;
    const perDay = units / windowDays;
    const daysLeft = perDay > 0 ? p.stockQty / perDay : Infinity;
    if (daysLeft > coverTargetDays) continue;
    const suggestQty = Math.max(
      1,
      Math.ceil(perDay * coverTargetDays - p.stockQty),
    );
    const sup = lastIn.get(p.id)?.supplierId ?? null;
    const s = sup ? supById.get(sup) : undefined;
    out.push({
      product: p,
      perDay: Math.round(perDay * 100) / 100,
      daysLeft: Math.round(daysLeft * 10) / 10,
      suggestQty,
      supplierId: sup,
      supplierName: s?.name ?? null,
      supplierPhone: s?.phone ?? null,
    });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
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
