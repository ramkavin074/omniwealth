import crypto from 'crypto';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { sessions } from '@/db/schema';
import { revokeWidgetKeysForSession } from '@/lib/widgetKeyRevoke';

// Same-origin sign-out for pages that can't call the logoutAction server
// action (the shared Kadai module, which also builds as a standalone app).
// POST only; the session cookie is SameSite so cross-site posts don't carry it.

export const dynamic = 'force-dynamic';

const SESSION_COOKIE_NAME = 'vault_session';

export async function POST() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (rawToken) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    await revokeWidgetKeysForSession(tokenHash);
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
  return new Response(null, { status: 204 });
}
