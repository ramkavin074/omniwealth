import { db } from '@/db';
import { clientErrors } from '@/db/schema';
import { getSessionUserAction } from '@/actions/vault';
import { checkRateLimit } from '@/lib/rate-limit';
import { logError } from '@/lib/log';
import { scrubUrlSecrets } from '@/lib/clientErrorReport';

export const dynamic = 'force-dynamic';

// Receives error reports from ErrorReporter. Public by necessity (errors can
// happen before sign-in), so it is size-capped, rate-limited per IP, stores
// only what the client helper already trimmed, and always answers 204.

const KINDS = new Set(['error', 'unhandledrejection', 'route-error', 'global-error']);
const PLATFORMS = new Set(['web', 'ios', 'android']);
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
// Defence in depth: never trust the client to have scrubbed secrets.
const clean = (v: unknown, n: number) => scrubUrlSecrets(clip(v, n));

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function POST(request: Request) {
  const noContent = () => new Response(null, { status: 204 });
  try {
    const raw = await request.text();
    if (raw.length > 8000) return noContent();
    const data = JSON.parse(raw) as Record<string, unknown>;

    const kind = clip(data.kind, 30);
    const message = clean(data.message, 400);
    if (!KINDS.has(kind) || !message) return noContent();

    const gate = await checkRateLimit(`client-error:${clientIp(request)}`, 40, 60);
    if (!gate.allowed) return noContent();

    const session = await getSessionUserAction().catch(() => null);
    const platform = clip(data.platform, 10);

    await db.insert(clientErrors).values({
      kind,
      message,
      stack: clean(data.stack, 1600) || null,
      path: clean(data.path, 200) || null,
      platform: PLATFORMS.has(platform) ? platform : 'web',
      appVersion: clip(data.appVersion, 20) || null,
      userAgent: clip(request.headers.get('user-agent'), 250) || null,
      userId: session?.user?.id ?? null,
    });
  } catch (err) {
    // Table not created yet, bad JSON, etc. — never surface to the client.
    logError('api/client-error', err);
  }
  return noContent();
}
