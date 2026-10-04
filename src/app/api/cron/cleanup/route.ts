import { NextRequest, NextResponse } from 'next/server';
import { lt } from 'drizzle-orm';
import { db } from '@/db';
import { clientErrors, passwordResets, rateLimits, sessions, widgetKeys } from '@/db/schema';
import { logError } from '@/lib/log';

// Daily housekeeping: drop expired auth rows so these tables don't grow
// without bound. Invoked by Vercel Cron (see vercel.json) with
// `Authorization: Bearer $CRON_SECRET`.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const now = new Date();
    const s = await db
      .delete(sessions)
      .where(lt(sessions.expiresAt, now))
      .returning({ id: sessions.id });
    const p = await db
      .delete(passwordResets)
      .where(lt(passwordResets.expiresAt, now))
      .returning({ id: passwordResets.id });
    const r = await db
      .delete(rateLimits)
      .where(lt(rateLimits.resetAt, now))
      .returning({ key: rateLimits.key });
    // Error reports older than 30 days (table may not exist yet).
    let errorsPruned = 0;
    try {
      const old = await db
        .delete(clientErrors)
        .where(lt(clientErrors.createdAt, new Date(now.getTime() - 30 * 86400000)))
        .returning({ id: clientErrors.id });
      errorsPruned = old.length;
    } catch {
      /* client_errors not created yet */
    }
    // Widget keys that expired more than 30 days ago (table may not exist yet).
    let keysPruned = 0;
    try {
      const oldKeys = await db
        .delete(widgetKeys)
        .where(lt(widgetKeys.expiresAt, new Date(now.getTime() - 30 * 86400000)))
        .returning({ id: widgetKeys.id });
      keysPruned = oldKeys.length;
    } catch {
      /* widget_keys not created yet */
    }
    return NextResponse.json({
      ok: true,
      deleted: {
        widgetKeys: keysPruned,
        clientErrors: errorsPruned,
        sessions: s.length,
        passwordResets: p.length,
        rateLimits: r.length,
      },
    });
  } catch (err) {
    logError('cron/cleanup', err);
    return NextResponse.json(
      { ok: false, error: 'Cleanup run failed' },
      { status: 500 },
    );
  }
}
