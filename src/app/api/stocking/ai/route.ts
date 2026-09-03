import { GoogleGenAI } from '@google/genai';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { db } from '@/db';
import {
  storeCustomers,
  storeExpenses,
  storeOrders,
  storeProducts,
  storeReceipts,
  storeSales,
  storeStockMovements,
  storeUpiReceipts,
  stores,
  suppliers,
  supplierPayments,
  users,
} from '@/db/schema';
import { checkRateLimit } from '@/lib/rate-limit';
import { decryptSecret } from '@/lib/crypto';
import { canEditCatalogue, resolveStockingAuth } from '@/lib/stockingAuth';
import { corsHeaders, corsPreflight } from '@/lib/stockingCors';

// "Ask" assistant for the stocking app. Builds a compact snapshot of the
// caller's store (role-aware — no cost/margin for staff) and answers one
// question with Gemini. Online-only.

export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return corsPreflight(request, 'POST, OPTIONS');
}

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** Whole days from today to a 'YYYY-MM-DD' string; null if unparseable. */
const daysTo = (iso: string | null): number | null => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const then = new Date(y, m - 1, d).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.round((then - today) / 864e5);
};

export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'), 'POST, OPTIONS');
  const json = (b: unknown, s: number) => Response.json(b, { status: s, headers });

  const auth = await resolveStockingAuth(request);
  if (!auth) return json({ error: 'Unauthorized' }, 401);

  let question = '';
  try {
    question = String((await request.json())?.question ?? '')
      .trim()
      .slice(0, 500);
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }
  if (!question) return json({ error: 'Ask a question first.' }, 400);

  const limit = await checkRateLimit(`stocking-ai:${auth.userId}`, 30, 60);
  if (!limit.allowed) {
    return json(
      { error: `Limit reached — try again in ~${limit.retryAfterMinutes} min` },
      429,
    );
  }

  const [user] = await db
    .select({ gk: users.geminiApiKey })
    .from(users)
    .where(eq(users.id, auth.userId));
  const apiKey = decryptSecret(user?.gk) || process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ error: 'AI is not configured' }, 503);

  const manage = canEditCatalogue(auth.role);
  const dayAgo = new Date(Date.now() - 30 * 864e5);

  // Current Indian financial year (1 Apr – 31 Mar).
  const nowD = new Date();
  const fyStart = nowD.getMonth() >= 3 ? nowD.getFullYear() : nowD.getFullYear() - 1;
  const fyFrom = String(new Date(fyStart, 3, 1).getTime());
  const fyTo = String(new Date(fyStart + 1, 3, 1).getTime());

  const [
    products,
    movements,
    sups,
    pays,
    fySales,
    storeRow,
    upiReceipts,
    custs,
    creditSales,
    receipts,
    openOrders,
    expenseRows,
  ] = await Promise.all([
    db
      .select()
      .from(storeProducts)
      .where(
        and(eq(storeProducts.storeId, auth.storeId), isNull(storeProducts.deletedAt)),
      ),
    db
      .select()
      .from(storeStockMovements)
      .where(
        and(
          eq(storeStockMovements.storeId, auth.storeId),
          gt(storeStockMovements.syncedAt, dayAgo),
        ),
      ),
    manage
      ? db
          .select()
          .from(suppliers)
          .where(and(eq(suppliers.storeId, auth.storeId), isNull(suppliers.deletedAt)))
      : Promise.resolve([]),
    manage
      ? db.select().from(supplierPayments).where(eq(supplierPayments.storeId, auth.storeId))
      : Promise.resolve([]),
    manage
      ? db
          .select()
          .from(storeSales)
          .where(
            and(
              eq(storeSales.storeId, auth.storeId),
              isNull(storeSales.deletedAt),
              gt(storeSales.createdAt, fyFrom),
              lt(storeSales.createdAt, fyTo),
            ),
          )
      : Promise.resolve([]),
    manage
      ? db
          .select()
          .from(stores)
          .where(eq(stores.id, auth.storeId))
          .then((r) => r[0])
      : Promise.resolve(undefined),
    manage
      ? db
          .select()
          .from(storeUpiReceipts)
          .where(
            and(
              eq(storeUpiReceipts.storeId, auth.storeId),
              isNull(storeUpiReceipts.deletedAt),
            ),
          )
      : Promise.resolve([]),
    manage
      ? db
          .select()
          .from(storeCustomers)
          .where(
            and(
              eq(storeCustomers.storeId, auth.storeId),
              isNull(storeCustomers.deletedAt),
            ),
          )
      : Promise.resolve([]),
    manage
      ? db
          .select()
          .from(storeSales)
          .where(
            and(
              eq(storeSales.storeId, auth.storeId),
              isNull(storeSales.deletedAt),
            ),
          )
      : Promise.resolve([]),
    manage
      ? db
          .select()
          .from(storeReceipts)
          .where(
            and(
              eq(storeReceipts.storeId, auth.storeId),
              isNull(storeReceipts.deletedAt),
            ),
          )
      : Promise.resolve([]),
    db
      .select()
      .from(storeOrders)
      .where(
        and(eq(storeOrders.storeId, auth.storeId), isNull(storeOrders.deletedAt)),
      ),
    manage
      ? db
          .select()
          .from(storeExpenses)
          .where(
            and(
              eq(storeExpenses.storeId, auth.storeId),
              isNull(storeExpenses.deletedAt),
            ),
          )
      : Promise.resolve([]),
  ]);

  const catalogue = products.map((p) => {
    const row: Record<string, unknown> = {
      name: p.name,
      stock: n(p.stockQty),
      unit: p.unit,
      price: n(p.price),
      low: n(p.stockQty) <= n(p.lowStockThreshold),
    };
    if (manage) row.cost = n(p.costPrice);
    if (p.expiryDate) row.expiry = p.expiryDate;
    return row;
  });

  // Items on hand that are expired or expiring within 30 days.
  const expiringSoon = products
    .map((p) => ({ p, d: daysTo(p.expiryDate) }))
    .filter((x) => x.d !== null && x.d <= 30 && n(x.p.stockQty) > 0)
    .sort((a, b) => (a.d as number) - (b.d as number))
    .map((x) => ({
      name: x.p.name,
      expiry: x.p.expiryDate,
      daysLeft: x.d,
      stock: n(x.p.stockQty),
      unit: x.p.unit,
    }));

  // 30-day sales from scan-out movements
  const priceOf = new Map(products.map((p) => [p.id, n(p.price)]));
  const soldUnits = new Map<string, number>();
  let salesValue = 0;
  for (const m of movements) {
    if (m.reason !== 'scan-out' || n(m.delta) >= 0) continue;
    const u = -n(m.delta);
    soldUnits.set(m.productId, (soldUnits.get(m.productId) ?? 0) + u);
    salesValue += u * (priceOf.get(m.productId) ?? 0);
  }
  const nameOf = new Map(products.map((p) => [p.id, p.name]));
  const topSellers = [...soldUnits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, u]) => ({ name: nameOf.get(id), units: u }));

  const supplierBalances = manage
    ? sups.map((s) => {
        const purchased = movements
          .filter((m) => m.supplierId === s.id && n(m.delta) > 0 && m.unitCost)
          .reduce((t, m) => t + n(m.delta) * n(m.unitCost), 0);
        const paid = pays
          .filter((p) => p.supplierId === s.id && p.deletedAt == null)
          .reduce((t, p) => t + n(p.amount), 0);
        return { name: s.name, owed: Math.round(purchased - paid) };
      })
    : [];

  // FY-to-date tax picture (owner/manager only).
  let taxSummary: Record<string, unknown> | undefined;
  if (manage) {
    let turnover = 0;
    let cash = 0;
    let digital = 0;
    let gstCollected = 0;
    for (const s of fySales) {
      turnover += n(s.total);
      cash += n(s.cashAmount);
      digital += n(s.upiAmount);
      gstCollected += n(s.taxTotal);
    }
    const presumptive = storeRow?.presumptive ?? true;
    const profit = presumptive
      ? Math.round(digital * 0.06 + Math.max(0, cash) * 0.08)
      : 0;
    // s.87A new-regime: nil up to ₹12L taxable.
    const estIncomeTax = presumptive && profit > 1200000 ? 'above ₹12L — consult accountant' : 0;
    taxSummary = {
      financialYear: `${fyStart}-${String(fyStart + 1).slice(2)}`,
      turnoverToDate: Math.round(turnover),
      cash: Math.round(cash),
      digital: Math.round(digital),
      gstRegistered: !!storeRow?.gstEnabled,
      gstScheme: storeRow?.gstScheme ?? 'regular',
      gstCollectedToDate: Math.round(gstCollected),
      presumptiveScheme: presumptive,
      presumptiveProfitToDate: profit,
      estimatedIncomeTax: estIncomeTax,
      note: 'GST return due 20th of next month; advance income tax on 15 Jun / 15 Sep / 15 Dec / 15 Mar. Estimates only.',
    };
  }

  // Today's UPI reconciliation (owner/manager only).
  let upiReconcile: Record<string, unknown> | undefined;
  if (manage) {
    const ds = new Date();
    ds.setHours(0, 0, 0, 0);
    const dStart = ds.getTime();
    const dEnd = dStart + 86_400_000;
    let appUpi = 0;
    for (const s of fySales) {
      const c = Number(s.createdAt);
      if (c < dStart || c >= dEnd || s.refundOf) continue;
      if (s.tenderType === 'upi' || s.tenderType === 'split') appUpi += n(s.upiAmount);
    }
    let received = 0;
    let unmatchedBills = 0;
    const matched = new Set(
      upiReceipts
        .filter((r) => Number(r.receivedAt) >= dStart && Number(r.receivedAt) < dEnd)
        .map((r) => r.matchedSaleId)
        .filter(Boolean),
    );
    for (const r of upiReceipts) {
      const rt = Number(r.receivedAt);
      if (rt >= dStart && rt < dEnd) received += n(r.amount);
    }
    for (const s of fySales) {
      const c = Number(s.createdAt);
      if (c < dStart || c >= dEnd || s.refundOf) continue;
      if (
        (s.tenderType === 'upi' || s.tenderType === 'split') &&
        n(s.upiAmount) > 0 &&
        !matched.has(s.id)
      ) {
        unmatchedBills++;
      }
    }
    upiReconcile = {
      appUpiToday: Math.round(appUpi),
      receivedToday: Math.round(received),
      difference: Math.round(received - appUpi),
      billsWithoutConfirmedPayment: unmatchedBills,
      note:
        upiReceipts.length === 0
          ? 'No UPI receipts logged yet — reconciliation not set up.'
          : 'difference 0 means every UPI bill is accounted for.',
    };
  }

  // Customer receivables (owner/manager only). Balance = opening + Σ unpaid
  // portion of every sale (total − cash − upi; refunds net negative) − Σ receipts.
  let receivables: Record<string, unknown> | undefined;
  if (manage) {
    const salesBy = new Map<string, number>();
    for (const s of creditSales) {
      if (!s.customerId) continue;
      const owed = n(s.total) - n(s.cashAmount) - n(s.upiAmount);
      if (owed === 0) continue;
      salesBy.set(s.customerId, (salesBy.get(s.customerId) ?? 0) + owed);
    }
    const paidBy = new Map<string, number>();
    for (const r of receipts) {
      paidBy.set(r.customerId, (paidBy.get(r.customerId) ?? 0) + n(r.amount));
    }
    const rows = custs
      .map((c) => {
        const bal =
          n(c.openingBalance) +
          (salesBy.get(c.id) ?? 0) -
          (paidBy.get(c.id) ?? 0);
        const overLimit = n(c.creditLimit) > 0 && bal > n(c.creditLimit);
        return { name: c.name, owed: Math.round(bal), overLimit };
      })
      .filter((r) => r.owed !== 0)
      .sort((a, b) => b.owed - a.owed);
    receivables = {
      totalToCollect: rows.reduce((t, r) => t + Math.max(0, r.owed), 0),
      customerCount: rows.filter((r) => r.owed > 0).length,
      overLimitCount: rows.filter((r) => r.overLimit).length,
      byCustomer: rows.slice(0, 20),
    };
  }

  // Open advance-booked orders / job-work (all roles).
  const openList = openOrders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled',
  );
  const in7 = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);
  const orders = {
    open: openList.length,
    ready: openList.filter((o) => o.status === 'ready').length,
    dueSoon: openList.filter(
      (o) => o.dueDate && (o.dueDate <= in7 || o.dueDate < todayStr),
    ).length,
    advanceHeld: Math.round(
      openList.reduce((t, o) => t + n(o.advancePaid), 0),
    ),
    balanceDue: Math.round(
      openList.reduce(
        (t, o) => t + Math.max(0, n(o.total) - n(o.advancePaid)),
        0,
      ),
    ),
    byOrder: openList
      .slice(0, 20)
      .map((o) => ({
        orderNo: o.orderNo,
        customer: o.customerName,
        total: Math.round(n(o.total)),
        balance: Math.round(n(o.total) - n(o.advancePaid)),
        status: o.status,
        due: o.dueDate ?? null,
      })),
  };

  // Shop running-cost expenses this calendar month (manage only).
  let expenses: Record<string, unknown> | undefined;
  if (manage) {
    const now = new Date();
    const mFrom = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const rows = expenseRows.filter((e) => n(e.spentAt) >= mFrom);
    const byCat = new Map<string, number>();
    let cash = 0;
    for (const e of rows) {
      byCat.set(e.category, (byCat.get(e.category) ?? 0) + n(e.amount));
      if (e.tender !== 'upi') cash += n(e.amount);
    }
    expenses = {
      monthTotal: Math.round(rows.reduce((t, e) => t + n(e.amount), 0)),
      count: rows.length,
      cashPaidOut: Math.round(cash),
      byCategory: [...byCat.entries()]
        .map(([category, amount]) => ({ category, amount: Math.round(amount) }))
        .sort((a, b) => b.amount - a.amount),
    };
  }

  const context = {
    products: catalogue.length,
    lowCount: catalogue.filter((c) => c.low).length,
    today: new Date().toISOString().slice(0, 10),
    salesLast30Days: Math.round(salesValue),
    topSellers,
    expiringSoon,
    ...(orders.open > 0 ? { orders } : {}),
    ...(manage
      ? { supplierBalances, taxSummary, upiReconcile, receivables, expenses }
      : {}),
    catalogue,
  };

  const system =
    `You are a concise assistant for a small Indian retail shop's stock app. ` +
    `Answer ONLY from the JSON below. Money is in ₹. Dates are YYYY-MM-DD; ` +
    `"today" is given and "daysLeft" is days until expiry (negative = already ` +
    `expired). If asked something not in the data, say you don't have that. ` +
    `Keep it short, plain text, no markdown tables. Reply in the same language ` +
    `as the question.\n\nDATA:\n` +
    JSON.stringify(context);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      contents: [{ text: `${system}\n\nQUESTION: ${question}` }],
    });
    return json({ answer: (res.text || '').trim() || '—' }, 200);
  } catch (e) {
    console.error('[stocking] ai failed', e);
    return json({ error: 'AI request failed, try again' }, 502);
  }
}
