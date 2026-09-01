import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { households, sessions, users } from '@/db/schema';

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

// The standalone APK's WebView runs on a Capacitor localhost origin, so this
// endpoint is cross-origin for it. It carries no cookies (bearer token in the
// JSON body), so a narrow allow-list is safe. Extra origins via
// STOCKING_ALLOWED_ORIGINS (comma-separated) for staging builds.
const ALLOWED_ORIGINS = new Set(
  [
    'https://localhost',
    'http://localhost',
    'capacitor://localhost',
    ...(process.env.STOCKING_ALLOWED_ORIGINS?.split(',') ?? []),
  ]
    .map((o) => o.trim())
    .filter(Boolean),
);

function corsHeaders(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
  }
  return { Vary: 'Origin' };
}

function json(
  body: unknown,
  status: number,
  origin: string | null,
): Response {
  return Response.json(body, { status, headers: corsHeaders(origin) });
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin')),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');

  let email = '';
  let password = '';
  try {
    const body = await request.json();
    email = String(body?.email ?? '').trim().toLowerCase();
    password = String(body?.password ?? '');
  } catch {
    return json({ error: 'Invalid request body.' }, 400, origin);
  }

  if (!email || !password) {
    return json({ error: 'Email and password are required.' }, 400, origin);
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
    return json({ error: 'Invalid email or password.' }, 401, origin);
  }

  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.id, user.householdId))
    .limit(1);

  if (!household) {
    return json({ error: 'Household not found.' }, 401, origin);
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
      householdId: household.id,
      displayName: user.fullName,
      stockingEnabled: household.stockingEnabled === true,
    },
    200,
    origin,
  );
}
