import crypto from 'crypto';
import { and, between, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { storeSmsIngest, storeUpiReceipts } from '@/db/schema';
import { checkRateLimit } from '@/lib/rate-limit';
import { clampSmsText, hashToken, smsRef } from '@/lib/smsIngest';
import { parseUpiMessages } from '@/lib/upiMessage';

// Receives a bank "money received" SMS from an iPhone Shortcuts automation, using the shop's
// private link (?k=<secret>), and records it as a UPI receipt. The phones pick it up on their
// next sync and match it to bills. The secret is the only credential, so it is stored hashed,
// failures all look alike, and every call is rate limited.

export const dynamic = 'force-dynamic';

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

async function readText(request: Request): Promise<string> {
  const type = request.headers.get('content-type') ?? '';
  try {
    if (type.includes('multipart/form-data') || type.includes('application/x-www-form-urlencoded')) {
      const fd = await request.formData();
      const v = fd.get('text') ?? fd.get('message') ?? fd.get('body');
      return typeof v === 'string' ? v : '';
    }
    const raw = await request.text();
    if (type.includes('json') || raw.trim().startsWith('{')) {
      try {
        const o = JSON.parse(raw);
        const v = o?.text ?? o?.message ?? o?.body;
        return typeof v === 'string' ? v : '';
      } catch {
        return raw;
      }
    }
    return raw;
  } catch {
    return '';
  }
}

export async function POST(request: Request) {
  const notFound = () => Response.json({ error: 'Not found' }, { status: 404 });

  // Throttle by caller first so guessing links is not practical.
  const ipLimit = await checkRateLimit(`sms-ingest:ip:${clientIp(request)}`, 90, 10);
  if (!ipLimit.allowed) return Response.json({ error: 'Too many requests' }, { status: 429 });

  const token = new URL(request.url).searchParams.get('k')?.trim() ?? '';
  if (token.length < 20 || token.length > 200) return notFound();

  const [link] = await db
    .select({ storeId: storeSmsIngest.storeId })
    .from(storeSmsIngest)
    .where(eq(storeSmsIngest.tokenHash, hashToken(token)))
    .limit(1);
  if (!link) return notFound();
  const storeId = link.storeId;

  const text = clampSmsText(await readText(request)).trim();
  const now = Date.now();
  await db
    .update(storeSmsIngest)
    .set({ lastReceivedAt: String(now) })
    .where(eq(storeSmsIngest.storeId, storeId));
  if (!text) return Response.json({ ok: true, added: 0, skipped: 0 });

  const parsed = parseUpiMessages(text, now);
  let added = 0;
  let duplicates = 0;
  for (const r of parsed.receipts) {
    const ref = r.ref ?? smsRef(text, now);
    // Same transaction reference, or the same amount within a minute of an existing receipt.
    const [sameRef] = await db
      .select({ id: storeUpiReceipts.id })
      .from(storeUpiReceipts)
      .where(
        and(
          eq(storeUpiReceipts.storeId, storeId),
          eq(storeUpiReceipts.ref, ref),
          isNull(storeUpiReceipts.deletedAt),
        ),
      )
      .limit(1);
    if (sameRef) {
      duplicates++;
      continue;
    }
    const near = await db
      .select({ amount: storeUpiReceipts.amount, ref: storeUpiReceipts.ref })
      .from(storeUpiReceipts)
      .where(
        and(
          eq(storeUpiReceipts.storeId, storeId),
          isNull(storeUpiReceipts.deletedAt),
          between(storeUpiReceipts.receivedAt, String(r.receivedAt - 60_000), String(r.receivedAt + 60_000)),
        ),
      );
    // A receipt with a real reference is only a duplicate of one with that same reference.
    if (!r.ref && near.some((n) => Math.abs(Number(n.amount) - r.amount) < 0.01 && n.ref?.startsWith('sms:'))) {
      duplicates++;
      continue;
    }
    await db.insert(storeUpiReceipts).values({
      id: crypto.randomUUID(),
      storeId,
      userId: null,
      amount: String(r.amount),
      receivedAt: String(r.receivedAt),
      ref,
      payerName: r.payer,
      source: 'sms',
      matchedSaleId: null,
      note: null,
      updatedAt: String(now),
      deletedAt: null,
      syncedAt: new Date(now),
    });
    added++;
  }
  return Response.json({ ok: true, added, skipped: parsed.skipped + duplicates });
}
