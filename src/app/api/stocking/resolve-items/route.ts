import { GoogleGenAI, Type } from '@google/genai';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { storeProducts, users } from '@/db/schema';
import { checkRateLimit } from '@/lib/rate-limit';
import { decryptSecret } from '@/lib/crypto';
import { resolveStockingAuth } from '@/lib/stockingAuth';
import { corsHeaders, corsPreflight } from '@/lib/stockingCors';

// Voice billing: a transcribed spoken shopping list (Tamil / English / mixed,
// with recognition errors) → matched catalogue rows + quantities. The client
// reviews the result in the cart before anything is billed. Any role — selling
// is a counter job. Online-only; the client falls back to a local matcher
// offline.

export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return corsPreflight(request, 'POST, OPTIONS');
}

const PROMPT =
  'The text below is a shopping list spoken aloud at an Indian retail counter ' +
  'and auto-transcribed. It may be Tamil, English or a mix, and may contain ' +
  'transcription errors, phonetic spellings and colloquial / short product ' +
  'names (e.g. "atta", "oil", "maggi"). A numbered CATALOGUE of the shop\'s ' +
  'products follows. For every distinct item the speaker asked for, pick the ' +
  'single best-matching catalogue row and the quantity. Interpret number words ' +
  'in any language ("இரண்டு"=2, "half"=0.5, "dozen"=12); default quantity 1. ' +
  'Return { matched: [{ i: <catalogue number>, qty: <number> }], unmatched: ' +
  '[<the spoken phrase>] }. Put an item in "unmatched" only if no row is a ' +
  'reasonable match — do not guess wildly.';

const schema = {
  type: Type.OBJECT,
  properties: {
    matched: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          i: { type: Type.NUMBER },
          qty: { type: Type.NUMBER },
        },
        required: ['i', 'qty'],
      },
    },
    unmatched: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['matched', 'unmatched'],
};

export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'), 'POST, OPTIONS');
  const json = (b: unknown, s: number) => Response.json(b, { status: s, headers });

  const auth = await resolveStockingAuth(request);
  if (!auth) return json({ error: 'Unauthorized' }, 401);

  let transcript = '';
  try {
    transcript = String((await request.json())?.transcript ?? '')
      .trim()
      .slice(0, 400);
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }
  if (!transcript) return json({ error: 'Nothing to resolve' }, 400);

  const limit = await checkRateLimit(`stocking-voice:${auth.userId}`, 60, 60);
  if (!limit.allowed) {
    return json(
      { error: `Slow down — try again in ~${limit.retryAfterMinutes} min` },
      429,
    );
  }

  const [user] = await db
    .select({ gk: users.geminiApiKey })
    .from(users)
    .where(eq(users.id, auth.userId));
  const apiKey = decryptSecret(user?.gk) || process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ error: 'AI is not configured' }, 503);

  const catalogue = await db
    .select({ id: storeProducts.id, name: storeProducts.name })
    .from(storeProducts)
    .where(
      and(
        eq(storeProducts.storeId, auth.storeId),
        isNull(storeProducts.deletedAt),
      ),
    );
  if (catalogue.length === 0) return json({ items: [], unmatched: [] }, 200);

  const list = catalogue
    .map((p, idx) => `${idx + 1}. ${p.name}`)
    .join('\n')
    .slice(0, 12000);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      contents: [
        { text: `${PROMPT}\n\nSPOKEN: ${transcript}\n\nCATALOGUE:\n${list}` },
      ],
      config: { responseMimeType: 'application/json', responseSchema: schema },
    });
    const parsed = JSON.parse(res.text || '{"matched":[],"unmatched":[]}') as {
      matched?: { i: number; qty: number }[];
      unmatched?: string[];
    };

    const seen = new Set<string>();
    const items: { productId: string; name: string; qty: number }[] = [];
    for (const m of parsed.matched ?? []) {
      const row = catalogue[Math.round(m.i) - 1];
      if (!row || seen.has(row.id)) continue;
      seen.add(row.id);
      const qty = Number(m.qty);
      items.push({
        productId: row.id,
        name: row.name,
        qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      });
    }
    const unmatched = (parsed.unmatched ?? [])
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 10);

    return json({ items, unmatched }, 200);
  } catch (err) {
    console.error('[stocking] resolve-items failed', err);
    return json({ error: 'Could not match the items' }, 502);
  }
}
