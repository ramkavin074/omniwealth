import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { sendMail } from '@/lib/mailer';
import { checkRateLimit } from '@/lib/rate-limit';
import { EMAIL_RE, makeTicket, newCode, signingKey } from '@/lib/kadaiSignup';
import { corsHeaders, corsPreflight } from '@/lib/stockingCors';

// Step 1 of Kadai self sign-up: email a 6-digit code to prove the address is theirs. Nothing is
// created yet. The reply carries a signed ticket (no database row) that only the emailed code
// can complete.

export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'));
  const json = (b: unknown, s = 200) => Response.json(b, { status: s, headers });

  const key = signingKey();
  if (!key) return json({ error: 'Sign-up is not available right now.' }, 503);

  let email = '';
  let name = '';
  try {
    const body = await request.json();
    email = String(body?.email ?? '').trim().toLowerCase();
    name = String(body?.name ?? '').trim().slice(0, 60);
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: 'Enter a valid email address.' }, 400);

  const ip = await checkRateLimit(`kadai-signup:ip:${clientIp(request)}`, 8, 60);
  const em = await checkRateLimit(`kadai-signup:email:${email}`, 4, 60);
  if (!ip.allowed || !em.allowed) {
    return json({ error: 'Too many attempts. Please try again in a while.' }, 429);
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return json(
      { error: 'An account with this email already exists. Sign in, or use "Forgot password?".', exists: true },
      409,
    );
  }

  const code = newCode();
  const ticket = makeTicket(email, code, key);
  const html = `
    <div style="font-family:Arial,sans-serif;background:#0f172a;color:#f8fafc;padding:32px;border-radius:16px;">
      <h2 style="color:#2dd4bf;margin-top:0;">Kadai: your verification code</h2>
      <p style="color:#cbd5e1;font-size:14px;">${name ? `Hello ${esc(name)}, ` : ''}use this code to create your Kadai shop account:</p>
      <p style="font-size:34px;letter-spacing:8px;font-weight:bold;color:#fff;margin:18px 0;">${code}</p>
      <p style="color:#94a3b8;font-size:13px;">The code works for 15 minutes.</p>
      <p style="color:#94a3b8;font-size:13px;margin-top:16px;">
        உங்கள் கடை கணக்கை உருவாக்க இந்தக் குறியீட்டைப் பயன்படுத்துங்கள். 15 நிமிடங்கள் மட்டுமே செயல்படும்.
      </p>
      <p style="color:#64748b;font-size:12px;margin-top:22px;">If you did not ask for this, ignore this email.</p>
    </div>`;
  try {
    await sendMail({ to: email, subject: `Kadai: your code is ${code}`, html });
  } catch (error) {
    console.error('Kadai signup code email failed:', error);
    return json({ error: 'We could not send the email. Check the address and try again.' }, 502);
  }
  return json({ ok: true, ticket });
}
