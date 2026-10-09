import bcrypt from 'bcryptjs';
import { and, count, eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import {
  adminAudit,
  households,
  storeDayCloses,
  storeMembers,
  storeSales,
  storeStockMovements,
  storeUpiReceipts,
  stores,
  users,
} from '@/db/schema';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveStockingAuth } from '@/lib/stockingAuth';
import { corsHeaders, corsPreflight } from '@/lib/stockingCors';

// Delete my Kadai account (in-app, as the App Store requires for apps that let people sign up).
// Only for shop-only accounts. An account that also holds OmniWealth wealth data is refused and
// told to delete from the OmniWealth app, so nobody loses a wealth profile by accident.
// A shop whose only owner leaves is deleted with all its data; otherwise only the membership goes.

export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'));
  const json = (b: unknown, s = 200) => Response.json(b, { status: s, headers });

  const auth = await resolveStockingAuth(request);
  if (!auth) return json({ error: 'Unauthorized' }, 401);

  let password = '';
  try {
    const body = await request.json();
    if (body?.action !== 'delete') return json({ error: 'Unknown action.' }, 400);
    password = String(body?.password ?? '');
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  if (!password) return json({ error: 'Enter your password to confirm.' }, 400);

  const limit = await checkRateLimit(`kadai-delete:${auth.userId}`, 5, 60);
  if (!limit.allowed) return json({ error: 'Too many attempts. Try again later.' }, 429);

  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash, householdId: users.householdId })
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const [hh] = await db
    .select({ id: households.id, shell: households.isStoreShell })
    .from(households)
    .where(eq(households.id, user.householdId))
    .limit(1);
  if (!hh?.shell) {
    return json(
      {
        error:
          'This account also has OmniWealth data. Delete it from the OmniWealth app: Profile, then Security, then Delete account.',
        wealth: true,
      },
      409,
    );
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return json({ error: 'That password is not right.' }, 403);

  try {
    await db.transaction(async (tx) => {
      const mine = await tx
        .select({ storeId: storeMembers.storeId, role: storeMembers.role })
        .from(storeMembers)
        .where(eq(storeMembers.userId, user.id));

      for (const m of mine) {
        if (m.role === 'owner') {
          const [others] = await tx
            .select({ n: count() })
            .from(storeMembers)
            .where(
              and(
                eq(storeMembers.storeId, m.storeId),
                eq(storeMembers.role, 'owner'),
                ne(storeMembers.userId, user.id),
              ),
            );
          if (Number(others?.n ?? 0) === 0) {
            await tx.delete(stores).where(eq(stores.id, m.storeId)); // cascades to every shop table
            continue;
          }
        }
        await tx
          .delete(storeMembers)
          .where(and(eq(storeMembers.storeId, m.storeId), eq(storeMembers.userId, user.id)));
      }

      // Rows in shops that stay behind keep their data but lose the link to this person.
      await tx.update(stores).set({ createdBy: null }).where(eq(stores.createdBy, user.id));
      await tx.update(adminAudit).set({ actorId: null }).where(eq(adminAudit.actorId, user.id));
      await tx.update(storeSales).set({ userId: null }).where(eq(storeSales.userId, user.id));
      await tx.update(storeStockMovements).set({ userId: null }).where(eq(storeStockMovements.userId, user.id));
      await tx.update(storeUpiReceipts).set({ userId: null }).where(eq(storeUpiReceipts.userId, user.id));
      await tx.update(storeDayCloses).set({ userId: null }).where(eq(storeDayCloses.userId, user.id));

      await tx.delete(users).where(eq(users.id, user.id)); // sessions and keys cascade
      const [left] = await tx.select({ n: count() }).from(users).where(eq(users.householdId, hh.id));
      if (Number(left?.n ?? 0) === 0) await tx.delete(households).where(eq(households.id, hh.id));
    });
  } catch (error) {
    console.error('Kadai account deletion failed:', error);
    return json({ error: 'Could not delete the account. Please email admin@omniwealth.org.' }, 500);
  }
  return json({ ok: true });
}
