import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { passwordResets, storeMembers, users } from '@/db/schema';
import { sendMail } from '@/lib/mailer';
import { checkRateLimit } from '@/lib/rate-limit';
import { corsHeaders, corsPreflight } from '@/lib/stockingCors';

// "Forgot password?" for the Kadai app. Emails a link to the Kadai-branded reset page
// (/stocking/reset). The reply never reveals whether an account exists. Only accounts that
// belong to a shop get an email; wealth-app users use the OmniWealth sign-in page.

export const dynamic = 'force-dynamic';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_MINUTES = 20;

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

function appUrl(): string {
  const fallback =
    process.env.NODE_ENV === 'production' ? 'https://www.omniwealth.org' : 'http://localhost:3000';
  const raw = (process.env.APP_URL || '').trim();
  if (!raw) return fallback;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (process.env.NODE_ENV === 'production') u.protocol = 'https:';
    return u.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'));
  const ok = () => Response.json({ ok: true }, { status: 200, headers });

  let email = '';
  try {
    const body = await request.json();
    email = String(body?.email ?? '').trim().toLowerCase();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400, headers });
  }
  if (!EMAIL_REGEX.test(email) || email.length > 254) return ok();

  const ipLimit = await checkRateLimit(`kadai-reset:ip:${clientIp(request)}`, 8, 20);
  const emailLimit = await checkRateLimit(`kadai-reset:email:${email}`, 3, 20);
  if (!ipLimit.allowed || !emailLimit.allowed) return ok();

  const [user] = await db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) return ok();

  const [member] = await db
    .select({ storeId: storeMembers.storeId })
    .from(storeMembers)
    .where(eq(storeMembers.userId, user.id))
    .limit(1);
  if (!member) return ok();

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + RESET_MINUTES * 60_000);

  await db.delete(passwordResets).where(eq(passwordResets.userId, user.id));
  await db.insert(passwordResets).values({ userId: user.id, tokenHash, expiresAt });

  const link = `${appUrl()}/stocking/reset?token=${encodeURIComponent(rawToken)}`;
  const html = `
    <div style="font-family:Arial,sans-serif;background:#0f172a;color:#f8fafc;padding:32px;border-radius:16px;">
      <h2 style="color:#2dd4bf;margin-top:0;">Kadai: reset your password</h2>
      <p style="color:#cbd5e1;font-size:14px;">Hello ${esc(user.fullName)},</p>
      <p style="color:#cbd5e1;font-size:14px;">
        Tap the button to choose a new password for your Kadai shop account.
        The link works for ${RESET_MINUTES} minutes. Afterwards, open the Kadai app and sign in with the new password.
      </p>
      <a href="${esc(link)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold;margin-top:16px;">Choose a new password</a>
      <p style="color:#94a3b8;font-size:13px;margin-top:20px;">
        உங்கள் கடை கணக்கிற்கு புதிய கடவுச்சொல்லை அமைக்க மேலுள்ள பொத்தானை அழுத்துங்கள். இணைப்பு ${RESET_MINUTES} நிமிடங்கள் மட்டுமே செயல்படும்.
      </p>
      <p style="color:#64748b;font-size:12px;margin-top:24px;">If you did not ask for this, ignore this email.</p>
    </div>`;

  try {
    await sendMail({ to: email, subject: 'Kadai: reset your password', html });
  } catch (error) {
    console.error('Kadai password reset email failed:', error);
    await db.delete(passwordResets).where(eq(passwordResets.tokenHash, tokenHash));
  }
  return ok();
}
