import crypto from 'node:crypto';

// Widget keys: 256-bit random, shown to the phone once, stored only as a hash.
export const WIDGET_KEY_TTL_DAYS = 90;
export const WIDGET_KEY_ROTATE_DAYS = 30; // the app swaps in a fresh key after this
export const MAX_ACTIVE_WIDGET_KEYS_PER_USER = 5;

const PREFIX = 'owk_'; // makes a leaked key recognisable in logs / secret scanners

export function generateWidgetKey(): string {
  return PREFIX + crypto.randomBytes(32).toString('base64url');
}

export function hashWidgetKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/** Cheap shape check before touching the database. */
export function looksLikeWidgetKey(key: string | null | undefined): key is string {
  return typeof key === 'string' && /^owk_[A-Za-z0-9_-]{43}$/.test(key);
}

export function parseBearer(header: string | null): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  return m ? m[1] : null;
}
