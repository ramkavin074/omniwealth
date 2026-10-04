import crypto from 'node:crypto';

/** Report-link tokens are stored only as a SHA-256 hash. */
export function hashReportToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
