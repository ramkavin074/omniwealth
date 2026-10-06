import { GoogleGenAI, Type } from '@google/genai';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { storeProducts, users } from '@/db/schema';
import { checkRateLimit } from '@/lib/rate-limit';
import { decryptSecret } from '@/lib/crypto';
import { resolveStockingAuth } from '@/lib/stockingAuth';
import { corsHeaders, corsPreflight } from '@/lib/stockingCors';

// Voice billing, cloud path: a short recording of a spoken shopping list (Tamil / English /
// mixed) goes straight to Gemini together with the shop's product names, and comes back as
// catalogue rows + quantities. Gemini understands Tamil speech far better than the phone's
// built-in recogniser. The client reviews the result in the cart before anything is billed.
// Any role (selling is a counter job). The recording is not stored.

export const dynamic = 'force-dynamic';

// A 15 second 16 kHz mono WAV is ~480 KB; leave generous headroom, stay under the request cap.
const MAX_AUDIO_BASE64 = 2_000_000;

export function OPTIONS(request: Request) {
  return corsPreflight(request, 'POST, OPTIONS');
}

const PROMPT =
  'The audio is a person at an Indian retail counter reading out a shopping list, in Tamil, ' +
  'English or a mix of both, with quantities (e.g. "irandu kilo arisi", "oru colgate", ' +
  '"half kilo sugar"). Background noise is possible. A numbered CATALOGUE of the shop\'s ' +
  'products follows. First write what was said as "transcript" (Tamil script for Tamil words ' +
  'is fine). Then, for every distinct item asked for, pick the single best-matching catalogue ' +
  'row and the quantity. Interpret number words in any language ("இரண்டு"=2, "ஒன்றரை"=1.5, ' +
  '"அரை"=0.5, "half"=0.5, "dozen"=12); default quantity 1. Quantities are in the product\'s ' +
  'own unit; if the speaker used grams for a kilo item or ml for a litre item, convert (250 ' +
  'grams = 0.25 kg). Return { transcript, matched: [{ i: <catalogue number>, qty: <number> }], ' +
  'unmatched: [<the spoken phrase>] }. Put an item in "unmatched" only if no row is a ' +
  'reasonable match; do not guess wildly. If you hear no items at all, return empty lists.';

const schema = {
  type: Type.OBJECT,
  properties: {
    transcript: { type: Type.STRING },
    matched: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { i: { type: Type.NUMBER }, qty: { type: Type.NUMBER } },
        required: ['i', 'qty'],
      },
    },
    unmatched: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['transcript', 'matched', 'unmatched'],
};

export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'), 'POST, OPTIONS');
  const json = (b: unknown, s: number) => Response.json(b, { status: s, headers });

  const auth = await resolveStockingAuth(request);
  if (!auth) return json({ error: 'Unauthorized' }, 401);

  let audio = '';
  let mime = 'audio/wav';
  try {
    const body = await request.json();
    audio = String(body?.audio ?? '');
    if (typeof body?.mime === 'string' && /^audio\/(wav|x-wav|mpeg|mp3|aac|ogg|flac)$/.test(body.mime)) {
      mime = body.mime === 'audio/x-wav' ? 'audio/wav' : body.mime;
    }
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }
  if (!audio) return json({ error: 'Nothing to resolve' }, 400);
  if (audio.length > MAX_AUDIO_BASE64) return json({ error: 'Recording too long' }, 413);

  const limit = await checkRateLimit(`stocking-voice:${auth.userId}`, 60, 60);
  if (!limit.allowed) {
    return json({ error: `Slow down, try again in ~${limit.retryAfterMinutes} min` }, 429);
  }

  const [user] = await db
    .select({ gk: users.geminiApiKey })
    .from(users)
    .where(eq(users.id, auth.userId));
  const apiKey = decryptSecret(user?.gk) || process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ error: 'AI is not configured' }, 503);

  const catalogue = await db
    .select({ id: storeProducts.id, name: storeProducts.name, unit: storeProducts.unit })
    .from(storeProducts)
    .where(and(eq(storeProducts.storeId, auth.storeId), isNull(storeProducts.deletedAt)));
  if (catalogue.length === 0) return json({ items: [], unmatched: [], transcript: '' }, 200);

  const list = catalogue
    .map((p, idx) => `${idx + 1}. ${p.name} (${p.unit})`)
    .join('\n')
    .slice(0, 12000);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      contents: [
        { inlineData: { mimeType: mime, data: audio } },
        { text: `${PROMPT}\n\nCATALOGUE:\n${list}` },
      ],
      config: { responseMimeType: 'application/json', responseSchema: schema },
    });
    const parsed = JSON.parse(res.text || '{"transcript":"","matched":[],"unmatched":[]}') as {
      transcript?: string;
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

    return json({ items, unmatched, transcript: String(parsed.transcript ?? '').slice(0, 400) }, 200);
  } catch (err) {
    console.error('[stocking] resolve-audio failed', err);
    return json({ error: 'Could not understand the recording' }, 502);
  }
}
