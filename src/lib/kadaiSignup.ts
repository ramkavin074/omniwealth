// Helpers for Kadai self sign-up: password rules, the emailed 6-digit code, and a signed
// "ticket" that ties a code to one email address for 15 minutes without a database table.

import crypto from 'crypto';

export const CODE_TTL_MS = 15 * 60 * 1000;

/** Same rules as the OmniWealth sign-in, so one policy covers every account. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters long.';
  if (pw.length > 128) return 'Password must be 128 characters or less.';
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter.';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number.';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must contain at least one symbol.';
  return null;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function newCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function mac(key: string, email: string, code: string, expiry: number): string {
  return crypto
    .createHmac('sha256', key)
    .update(`kadai-signup|${email}|${code}|${expiry}`)
    .digest('hex')
    .slice(0, 40);
}

/** `<expiry>.<mac>`: only someone who knows the emailed code can produce a matching pair. */
export function makeTicket(email: string, code: string, key: string, now = Date.now()): string {
  const expiry = now + CODE_TTL_MS;
  return `${expiry}.${mac(key, email, code, expiry)}`;
}

export function checkTicket(
  ticket: string,
  email: string,
  code: string,
  key: string,
  now = Date.now(),
): 'ok' | 'expired' | 'bad' {
  const m = /^(\d{10,15})\.([0-9a-f]{40})$/.exec(ticket);
  if (!m) return 'bad';
  const expiry = Number(m[1]);
  const want = Buffer.from(mac(key, email, code.trim(), expiry));
  const got = Buffer.from(m[2]);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return 'bad';
  return expiry < now ? 'expired' : 'ok';
}

/** The shop name or person's name, cleaned for storage. */
export function cleanName(s: unknown, max = 60): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Secret for signing sign-up tickets. Null when the server has none configured. */
export function signingKey(): string | null {
  return process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || null;
}
