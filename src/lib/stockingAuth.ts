import crypto from 'crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/db';
import { sessions, storeMembers } from '@/db/schema';
import { getSessionUserAction } from '@/actions/auth';

// Resolves a stocking API caller to a store + role. Two auth paths:
//  - Bearer token (standalone APK) → hashed lookup in `sessions`
//  - Session cookie (in-OmniWealth /stocking page) → getSessionUserAction
// The user must be a member of the store. A multi-store user must name the
// store via the `x-store-id` header; a single-store user is resolved directly.

export type StoreRole = 'owner' | 'manager' | 'staff';

export interface StockingAuth {
  userId: string;
  storeId: string;
  role: StoreRole;
}

async function userIdFromRequest(request: Request): Promise<string | null> {
  const bearer = /^Bearer\s+(.+)$/i.exec(
    request.headers.get('authorization') ?? '',
  );
  if (bearer) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(bearer[1].trim())
      .digest('hex');
    const [row] = await db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return row?.userId ?? null;
  }
  const session = await getSessionUserAction();
  return session?.user.id ?? null;
}

export async function resolveStockingAuth(
  request: Request,
): Promise<StockingAuth | null> {
  const userId = await userIdFromRequest(request);
  if (!userId) return null;

  const memberships = await db
    .select({ storeId: storeMembers.storeId, role: storeMembers.role })
    .from(storeMembers)
    .where(eq(storeMembers.userId, userId));
  if (memberships.length === 0) return null;

  const wanted = request.headers.get('x-store-id');
  const chosen = wanted
    ? memberships.find((m) => m.storeId === wanted)
    : memberships.length === 1
      ? memberships[0]
      : null;
  if (!chosen) return null; // ambiguous, or the header didn't match a membership

  return {
    userId,
    storeId: chosen.storeId,
    role: (chosen.role as StoreRole) ?? 'staff',
  };
}

export function canEditCatalogue(role: StoreRole): boolean {
  return role === 'owner' || role === 'manager';
}
