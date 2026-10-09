import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '@/db';
import { households, storeMembers, stores, users } from '@/db/schema';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkTicket, cleanName, EMAIL_RE, passwordProblem, signingKey } from '@/lib/kadaiSignup';
import { corsHeaders, corsPreflight } from '@/lib/stockingCors';

// Step 2 of Kadai self sign-up: check the emailed code, then create the account: a shop-only
// household, the user, the shop and the owner membership. The app signs in right afterwards with
// the existing /api/stocking/session.

export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'));
  const json = (b: unknown, s = 200) => Response.json(b, { status: s, headers });

  const key = signingKey();
  if (!key) return json({ error: 'Sign-up is not available right now.' }, 503);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  const email = String(body.email ?? '').trim().toLowerCase();
  const code = String(body.code ?? '').trim();
  const ticket = String(body.ticket ?? '');
  const fullName = cleanName(body.name);
  const shopName = cleanName(body.shopName);
  const password = String(body.password ?? '');

  if (!EMAIL_RE.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
  if (fullName.length < 2) return json({ error: 'Enter your name.' }, 400);
  if (shopName.length < 2) return json({ error: 'Enter your shop name.' }, 400);
  const pwProblem = passwordProblem(password);
  if (pwProblem) return json({ error: pwProblem }, 400);
  if (body.acceptTerms !== true) return json({ error: 'Please accept the Terms and Privacy Policy.' }, 400);
  if (!/^\d{6}$/.test(code)) return json({ error: 'Enter the 6-digit code from your email.' }, 400);

  // Throttle guessing the code: per caller and per ticket.
  const ip = await checkRateLimit(`kadai-signup-fin:ip:${clientIp(request)}`, 20, 60);
  const tk = await checkRateLimit(
    `kadai-signup-fin:t:${crypto.createHash('sha256').update(ticket).digest('hex').slice(0, 24)}`,
    6,
    15,
  );
  if (!ip.allowed || !tk.allowed) {
    return json({ error: 'Too many attempts. Ask for a new code in a few minutes.' }, 429);
  }

  const verdict = checkTicket(ticket, email, code, key);
  if (verdict === 'expired') return json({ error: 'That code has expired. Ask for a new one.', expired: true }, 400);
  if (verdict !== 'ok') return json({ error: 'That code is not right. Check the email and try again.' }, 400);

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return json({ error: 'An account with this email already exists. Please sign in.', exists: true }, 409);

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await db.transaction(async (tx) => {
      const [hh] = await tx
        .insert(households)
        .values({ name: shopName, isStoreShell: true })
        .returning({ id: households.id });
      const [u] = await tx
        .insert(users)
        .values({ householdId: hh.id, email, passwordHash, fullName })
        .returning({ id: users.id });
      const [s] = await tx
        .insert(stores)
        .values({ name: shopName, status: 'trial', createdBy: u.id })
        .returning({ id: stores.id });
      await tx.insert(storeMembers).values({ storeId: s.id, userId: u.id, role: 'owner' });
    });
  } catch (error) {
    console.error('Kadai signup failed:', error);
    return json({ error: 'Could not create the account. Please try again.' }, 500);
  }
  return json({ ok: true });
}
