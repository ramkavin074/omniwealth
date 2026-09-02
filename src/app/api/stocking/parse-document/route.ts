import { GoogleGenAI, Type } from '@google/genai';
import { checkRateLimit } from '@/lib/rate-limit';
import { canEditCatalogue, resolveStockingAuth } from '@/lib/stockingAuth';
import { corsHeaders, corsPreflight } from '@/lib/stockingCors';

// Photo → structured data for the stocking module.
//   kind=invoice → line items to add to stock
//   kind=payment → a supplier payment (name, amount, date)
// Nothing is written here — the client reviews and commits. Owner/manager only.

export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return corsPreflight(request, 'POST, OPTIONS');
}

const INVOICE_PROMPT =
  'This is a supplier invoice / delivery challan for a retail shop. Extract every ' +
  'stock line item. For each: item name (as written), barcode if printed, quantity ' +
  'received (number), unit (piece/kg/liter/packet/box/dozen — best guess), and rate ' +
  'per unit (the purchase/cost price, a number). Ignore totals, taxes, headers and ' +
  'signatures. If a value is missing use 0 / empty string.';

const PAYMENT_PROMPT =
  'This is a payment receipt / UPI screenshot / cash memo for money paid by a shop ' +
  'to a supplier. Extract: supplier or payee name, amount paid (number), date ' +
  '(yyyy-mm-dd if visible else empty), and a reference/UTR if present.';

const invoiceSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      barcode: { type: Type.STRING },
      qty: { type: Type.NUMBER },
      unit: { type: Type.STRING },
      rate: { type: Type.NUMBER },
    },
    required: ['name', 'qty', 'rate'],
  },
};

const paymentSchema = {
  type: Type.OBJECT,
  properties: {
    supplierName: { type: Type.STRING },
    amount: { type: Type.NUMBER },
    date: { type: Type.STRING },
    reference: { type: Type.STRING },
  },
  required: ['supplierName', 'amount'],
};

export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'), 'POST, OPTIONS');
  const json = (body: unknown, status: number) =>
    Response.json(body, { status, headers });

  const auth = await resolveStockingAuth(request);
  if (!auth) return json({ error: 'Unauthorized' }, 401);
  if (!canEditCatalogue(auth.role)) {
    return json({ error: 'Not permitted for this role' }, 403);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ error: 'AI is not configured on the server' }, 503);

  const limit = await checkRateLimit(`stocking-doc:${auth.userId}`, 20, 60);
  if (!limit.allowed) {
    return json(
      { error: `Too many scans — try again in ~${limit.retryAfterMinutes} min` },
      429,
    );
  }

  let file: File | null = null;
  let kind = 'invoice';
  try {
    const form = await request.formData();
    file = form.get('image') as File | null;
    kind = String(form.get('kind') || 'invoice');
  } catch {
    return json({ error: 'Invalid form data' }, 400);
  }
  if (!file || file.size === 0) return json({ error: 'No image' }, 400);
  if (file.size > 8 * 1024 * 1024) return json({ error: 'Image too large' }, 413);

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || 'image/jpeg';
  const isPayment = kind === 'payment';

  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      contents: [
        { inlineData: { mimeType, data: buffer.toString('base64') } },
        { text: isPayment ? PAYMENT_PROMPT : INVOICE_PROMPT },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: isPayment ? paymentSchema : invoiceSchema,
      },
    });
    const parsed = JSON.parse(res.text || (isPayment ? '{}' : '[]'));
    return json({ kind, data: parsed }, 200);
  } catch (err) {
    console.error('[stocking] parse-document failed', err);
    return json({ error: 'Could not read the image — try a clearer photo' }, 502);
  }
}
