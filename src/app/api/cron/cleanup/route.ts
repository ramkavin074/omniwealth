import { NextRequest, NextResponse } from 'next/server';
import { lt } from 'drizzle-orm';
import { db } from '@/db';
import { passwordResets, rateLimits, sessions } from '@/db/schema';
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
    return NextResponse.json({
      ok: true,
      deleted: {
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
