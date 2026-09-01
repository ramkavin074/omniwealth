import crypto from 'crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/db';
import { households, sessions, users } from '@/db/schema';
import { getSessionUserAction } from '@/actions/auth';

// Resolves a stocking API caller to a household. Two paths:
//  - Bearer token (standalone APK) → hashed lookup in `sessions`
//  - Session cookie (in-OmniWealth /stocking page) → getSessionUserAction
// Either way the household must have the stocking module enabled.

export interface StockingAuth {
  userId: string;
  householdId: string;
}

export async function resolveStockingAuth(
  request: Request,
): Promise<StockingAuth | null> {
  const bearer = /^Bearer\s+(.+)$/i.exec(
    request.headers.get('authorization') ?? '',
  );

  if (bearer) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(bearer[1].trim())
      .digest('hex');

    const [row] = await db
      .select({
        userId: sessions.userId,
        householdId: users.householdId,
        stockingEnabled: households.stockingEnabled,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .innerJoin(households, eq(households.id, users.householdId))
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!row || row.stockingEnabled !== true) return null;
    return { userId: row.userId, householdId: row.householdId };
  }

  const session = await getSessionUserAction();
  if (!session || session.household?.stockingEnabled !== true) return null;
  return { userId: session.user.id, householdId: session.household.id };
}
