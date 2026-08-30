import { db } from '@/db';
import { sql } from 'drizzle-orm';

/**
 * Fixed-window rate limiter backed by the `rate_limits` table.
 *
 * Shared by the AI server actions to stop a single session from burning
 * the shared/fallback API keys. auth.ts keeps its own equivalent for the
 * login / register paths.
 *
 * `maxAttempts` calls are allowed inside `windowMinutes`; the next one is
 * blocked until the window resets.
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMinutes: number,
): Promise<{ allowed: boolean; retryAfterMinutes?: number }> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMinutes * 60 * 1000);

  const result = await db.execute(sql`
    INSERT INTO rate_limits (key, attempts, reset_at)
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT (key) DO UPDATE SET
      attempts =
        CASE WHEN rate_limits.reset_at <= ${now}
          THEN 1 ELSE rate_limits.attempts + 1 END,
      reset_at =
        CASE WHEN rate_limits.reset_at <= ${now}
          THEN ${resetAt} ELSE rate_limits.reset_at END
    RETURNING attempts, reset_at;
  `);

  const row = result.rows?.[0] as
    | { attempts: number; reset_at: string | Date }
    | undefined;

  if (!row) {
    return { allowed: false, retryAfterMinutes: windowMinutes };
  }

  const attempts = Number(row.attempts);

  if (attempts > maxAttempts) {
    const diffMs = new Date(row.reset_at).getTime() - now.getTime();
    return {
      allowed: false,
      retryAfterMinutes: Math.max(1, Math.ceil(diffMs / 60000)),
    };
  }

  return { allowed: true };
}
