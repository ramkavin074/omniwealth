import { GoogleGenAI } from '@google/genai';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/db';
import {
  storeProducts,
  storeStockMovements,
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

  const [products, movements, sups, pays] = await Promise.all([
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
    return row;
  });

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

  const context = {
    products: catalogue.length,
    lowCount: catalogue.filter((c) => c.low).length,
    salesLast30Days: Math.round(salesValue),
    topSellers,
    ...(manage ? { supplierBalances } : {}),
    catalogue,
  };

  const system =
    `You are a concise assistant for a small Indian retail shop's stock app. ` +
    `Answer ONLY from the JSON below. Money is in ₹. If asked something not in ` +
    `the data, say you don't have that. Keep it short, plain text, no markdown ` +
    `tables. Reply in the same language as the question.\n\nDATA:\n` +
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
