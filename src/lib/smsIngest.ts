// Helpers for the "bank SMS from an iPhone Shortcut" endpoint. Server-side.

import crypto from 'crypto';

/** A fresh secret for a shop's link. */
export function newIngestToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Identity for a message with no transaction reference: the same SMS delivered twice in
 *  the same minute collapses to one receipt, while two different payments do not. */
export function smsRef(text: string, atMs: number): string {
  const h = crypto.createHash('sha256').update(text.trim()).digest('hex').slice(0, 16);
  return `sms:${h}:${Math.floor(atMs / 60_000)}`;
}

/** Longest message we will look at (a bank SMS is a few hundred characters). */
export const MAX_SMS_CHARS = 2000;

export function clampSmsText(text: string): string {
  return text.slice(0, MAX_SMS_CHARS);
}
