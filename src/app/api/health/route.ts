import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

// Public, unauthenticated liveness + DB-connectivity probe for uptime
// monitors. Returns no data about the app or its contents.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({
      ok: true,
      db: 'up',
      ts: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, db: 'down' }, { status: 503 });
  }
}
