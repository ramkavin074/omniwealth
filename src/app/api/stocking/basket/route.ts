import { and, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { storeBaskets, stores } from '@/db/schema';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveStockingAuth } from '@/lib/stockingAuth';
import { corsHeaders, corsPreflight } from '@/lib/stockingCors';

// Customer self-scan basket handoff.
//   POST  { store, items:[{barcode,qty}] }  → { code }        (customer, public)
//   GET   ?store=&code=                     → { items }        (counter, auth)
// The QR path never touches this route — this is the "read the code out loud"
// fallback. Prices are never stored; the counter re-prices locally.

export const dynamic = 'force-dynamic';

const TTL_MS = 2 * 60 * 60 * 1000;
const MAX_ITEMS = 120;
// no I/O/0/1 — read aloud cleanly
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode(): string {
  let c = '';
  for (let i = 0; i < 4; i++) {
    c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return c;
}

function cleanItems(raw: unknown): { barcode: string; qty: number }[] {
  if (!Array.isArray(raw)) return [];
  const out: { barcode: string; qty: number }[] = [];
  for (const r of raw.slice(0, MAX_ITEMS)) {
    const barcode = String((r as { barcode?: unknown })?.barcode ?? '').trim();
    const qtyN = Number((r as { qty?: unknown })?.qty);
    if (!barcode || !(qtyN > 0)) continue;
    out.push({ barcode, qty: Math.round(qtyN * 1000) / 1000 });
  }
  return out;
}

export function OPTIONS(request: Request) {
  return corsPreflight(request, 'GET, POST, OPTIONS');
}

// ---- customer submits a basket ----
export async function POST(request: Request) {
  let body: { store?: string; items?: unknown; paidUpi?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }
  const storeId = String(body.store ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) {
    return Response.json({ error: 'Unknown shop' }, { status: 404 });
  }
  const items = cleanItems(body.items);
  if (items.length === 0) {
    return Response.json({ error: 'Empty basket' }, { status: 400 });
  }
  const paidUpi = body.paidUpi === true;

  const [s] = await db
    .select({ selfScan: stores.selfScanEnabled, status: stores.status })
    .from(stores)
    .where(eq(stores.id, storeId));
  if (!s || s.status === 'suspended' || !s.selfScan) {
    return Response.json({ error: 'Self-scan is not enabled here' }, { status: 404 });
  }

  const limit = await checkRateLimit(`stocking-basket:${storeId}`, 120, 60);
  if (!limit.allowed) {
    return Response.json({ error: 'Try again shortly' }, { status: 429 });
  }

  // Sweep this store's expired baskets opportunistically.
  await db
    .delete(storeBaskets)
    .where(
      and(
        eq(storeBaskets.storeId, storeId),
        lt(storeBaskets.expiresAt, new Date()),
      ),
    );

  let code = makeCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const [clash] = await db
      .select({ id: storeBaskets.id })
      .from(storeBaskets)
      .where(
        and(
          eq(storeBaskets.storeId, storeId),
          eq(storeBaskets.code, code),
          isNull(storeBaskets.claimedAt),
          gt(storeBaskets.expiresAt, new Date()),
        ),
      );
    if (!clash) break;
    code = makeCode();
  }

  const expiresAt = new Date(Date.now() + TTL_MS);
  await db
    .insert(storeBaskets)
    .values({ storeId, code, items: { lines: items, paidUpi }, expiresAt });
  return Response.json({ code, expiresAt: expiresAt.toISOString() });
}

// ---- counter pulls a basket by code ----
export async function GET(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'), 'GET, POST, OPTIONS');
  const auth = await resolveStockingAuth(request);
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  }
  const url = new URL(request.url);
  const code = (url.searchParams.get('code') ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(code)) {
    return Response.json({ error: 'Bad code' }, { status: 400, headers });
  }

  const [b] = await db
    .select({ id: storeBaskets.id, items: storeBaskets.items })
    .from(storeBaskets)
    .where(
      and(
        eq(storeBaskets.storeId, auth.storeId),
        eq(storeBaskets.code, code),
        isNull(storeBaskets.claimedAt),
        gt(storeBaskets.expiresAt, new Date()),
      ),
    )
    .orderBy(sql`${storeBaskets.createdAt} desc`)
    .limit(1);

  if (!b) {
    return Response.json(
      { error: 'No basket for that code (it may have expired or been used)' },
      { status: 404, headers },
    );
  }

  await db
    .update(storeBaskets)
    .set({ claimedAt: new Date() })
    .where(eq(storeBaskets.id, b.id));

  const raw = b.items as { lines?: unknown; paidUpi?: unknown };
  return Response.json(
    { items: cleanItems(raw?.lines), paidUpi: raw?.paidUpi === true },
    { headers },
  );
}
