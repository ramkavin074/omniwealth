import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { sessions, storeMembers, stores, users } from '@/db/schema';
import { checkRateLimit } from '@/lib/rate-limit';
import { corsHeaders, corsPreflight } from '@/lib/stockingCors';

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

// Lightweight JSON auth for the standalone stocking APK. Verifies the user's
// OmniWealth password and issues a bearer token backed by the same `sessions`
// table getSessionUserAction() uses. The token is what a future
// /api/stocking/sync endpoint will authenticate. Needed once, online; the
// app runs offline afterwards.

export const dynamic = 'force-dynamic';

// Same lifetime as web sessions (SESSION_MAX_AGE_DAYS, default 30).
const MAX_AGE_SECONDS =
  60 * 60 * 24 * (Number(process.env.SESSION_MAX_AGE_DAYS) || 30);

const DUMMY_HASH =
  '$2a$10$abcdefghijklmnopqrstuv0123456789ABCDEFGHIJKLMNOPQRSTU';

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'));
  const json = (body: unknown, status: number) =>
    Response.json(body, { status, headers });

  let email = '';
  let password = '';
  try {
    const body = await request.json();
    email = String(body?.email ?? '').trim().toLowerCase();
    password = String(body?.password ?? '');
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  if (!email || !password) {
    return json({ error: 'Email and password are required.' }, 400);
  }

  // Brute-force protection: this endpoint verifies a password and is
  // reachable cross-origin from the APK. Limit per IP and per target email.
  const ip = clientIp(request);
  const ipLimit = await checkRateLimit(`stocking-session:ip:${ip}`, 15, 15);
  const emailLimit = await checkRateLimit(
    `stocking-session:email:${email}`,
    7,
    15,
  );
  if (!ipLimit.allowed || !emailLimit.allowed) {
    return json(
      { error: 'Too many sign-in attempts. Try again in a few minutes.' },
      429,
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const isBcrypt =
    !!user &&
    (user.passwordHash.startsWith('$2a$') ||
      user.passwordHash.startsWith('$2b$') ||
      user.passwordHash.startsWith('$2y$'));

  // Spend a bcrypt round even when the account is missing / has no usable
  // hash, so response timing doesn't leak which case it was.
  const valid = await bcrypt.compare(
    password,
    isBcrypt ? user.passwordHash : DUMMY_HASH,
  );

  if (!user || !isBcrypt || !valid) {
    return json({ error: 'Invalid email or password.' }, 401);
  }

  const memberships = await db
    .select({
      id: stores.id,
      name: stores.name,
      role: storeMembers.role,
    })
    .from(storeMembers)
    .innerJoin(stores, eq(stores.id, storeMembers.storeId))
    .where(eq(storeMembers.userId, user.id));

  if (memberships.length === 0) {
    return json({ error: 'This account has no shop access.' }, 403);
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  await db.insert(sessions).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + MAX_AGE_SECONDS * 1000),
  });

  return json(
    {
      token: rawToken,
      userId: user.id,
      displayName: user.fullName,
      stores: memberships,
    },
    200,
  );
}
