'use server';

import {
  db,
} from '@/db';

import {
  households,
  users,
  sessions,
  invitations,
  rateLimits,
  passwordResets,
  stores,
  storeMembers,
} from '@/db/schema';

import {
  and,
  eq,
  gt,
  ne,
  sql,
} from 'drizzle-orm';

import {
  cookies,
  headers,
} from 'next/headers';

import {
  revalidatePath,
} from 'next/cache';

import {
  redirect,
} from 'next/navigation';

import bcrypt from 'bcryptjs';

import crypto from 'crypto';

import {
  Resend,
} from 'resend';

import { logError } from '@/lib/log';
import { logAudit } from '@/lib/audit';

/**
 * ============================================================
 * CONSTANTS
 * ============================================================
 */

const SESSION_COOKIE_NAME = 'vault_session';

// Session lifetime, overridable via SESSION_MAX_AGE_DAYS (default 30).
const SESSION_MAX_AGE_SECONDS =
  60 * 60 * 24 * (Number(process.env.SESSION_MAX_AGE_DAYS) || 30);

// Keep at most this many active sessions per user; older ones are pruned
// on each new login.
const MAX_SESSIONS_PER_USER = 10;

const SESSION_COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: SESSION_MAX_AGE_SECONDS,
  priority: 'high' as const,
};

const BCRYPT_ROUNDS = 12;

// Single generic message for every login failure — never reveal whether
// an email is registered.
const INVALID_CREDENTIALS_ERROR = 'Invalid email or password.';

// Pre-computed bcrypt hash (cost 12) compared against when no user matches,
// so response time does not betray which emails exist.
const DUMMY_PASSWORD_HASH =
  '$2b$12$sII16HU35Cfh93dmpt3ABuB8x8.LpJEceoXPj8dnmEprjnuYipT/y';

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * ============================================================
 * RESEND
 * ============================================================
 */

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY is not configured.'
    );
  }

  return new Resend(apiKey);
}

const resend = new Resend(
  process.env.RESEND_API_KEY || 're_placeholder'
);

/**
 * ============================================================
 * APPLICATION URL
 * ============================================================
 */

function getAppUrl(): string {
  const fallback =
    process.env.NODE_ENV === 'production'
      ? 'https://www.omniwealth.org'
      : 'http://localhost:3000';

  const raw = (process.env.APP_URL || '').trim();
  if (!raw) return fallback;

  // Tolerate a value with no scheme ("www.omniwealth.org") — a bad env var
  // must never break invite / password-reset emails.
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return fallback;
  }

  if (
    process.env.NODE_ENV === 'production' &&
    parsed.protocol !== 'https:'
  ) {
    parsed.protocol = 'https:';
  }

  return parsed
    .toString()
    .replace(/\/$/, '');
}

/**
 * ============================================================
 * HTML ESCAPING
 * ============================================================
 */

function escapeHtml(
  str: string
): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}

/**
 * ============================================================
 * CLIENT IP
 * ============================================================
 *
 * Prefer infrastructure-provided headers.
 *
 * Do not blindly trust arbitrary x-forwarded-for values
 * unless your hosting/proxy infrastructure sanitizes them.
 */

async function getClientIp(): Promise<string> {
  const headerStore =
    await headers();

  const cloudflareIp =
    headerStore.get(
      'cf-connecting-ip'
    );

  if (cloudflareIp) {
    return cloudflareIp.trim();
  }

  const vercelIp =
    headerStore.get(
      'x-vercel-forwarded-for'
    );

  if (vercelIp) {
    return vercelIp
      .split(',')[0]
      .trim();
  }

  /**
   * x-real-ip is commonly supplied by trusted
   * reverse proxies.
   */
  const realIp =
    headerStore.get(
      'x-real-ip'
    );

  if (realIp) {
    return realIp.trim();
  }

  /**
   * Only use x-forwarded-for as a fallback.
   *
   * Your production proxy should sanitize this header.
   */
  const forwardedFor =
    headerStore.get(
      'x-forwarded-for'
    );

  if (forwardedFor) {
    return forwardedFor
      .split(',')[0]
      .trim();
  }

  return 'unknown';
}

/**
 * ============================================================
 * AUTHORIZATION HELPERS
 * ============================================================
 */

function isSuperAdmin(
  role: string
): boolean {
  return role === 'SUPER_ADMIN';
}

function isOwnerOrAdmin(
  role: string
): boolean {
  return [
    'SUPER_ADMIN',
    'OWNER',
    'ADMIN',
  ].includes(role);
}

function isOwnerOrSuperAdmin(
  role: string
): boolean {
  return [
    'SUPER_ADMIN',
    'OWNER',
  ].includes(role);
}

/**
 * ============================================================
 * PASSWORD POLICY
 * ============================================================
 */

function validatePassword(
  password: string
): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }

  if (password.length > 128) {
    return 'Password must be 128 characters or less.';
  }

  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }

  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain at least one symbol.';
  }

  return null;
}

/**
 * ============================================================
 * POSTGRES ERROR
 * ============================================================
 */

function isPostgresError(
  error: unknown
): error is {
  code: string;
  message?: string;
} {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (
      error as {
        code?: unknown;
      }
    ).code === 'string'
  );
}

/**
 * ============================================================
 * RATE LIMITING
 * ============================================================
 *
 * maxAttempts means actual successful attempts allowed
 * during the window.
 *
 * Example:
 *
 * maxAttempts = 5
 *
 * attempts 1-5 => allowed
 * attempt 6    => blocked
 */

async function checkAndIncrementRateLimit(
  identifier: string,
  maxAttempts: number,
  windowMinutes = 15
): Promise<{
  allowed: boolean;
  retryAfterMinutes?: number;
}> {
  const now = new Date();

  const resetAt = new Date(
    now.getTime() +
      windowMinutes *
        60 *
        1000
  );

  const result =
    await db.execute(sql`
      INSERT INTO rate_limits
        (key, attempts, reset_at)
      VALUES
        (
          ${identifier},
          1,
          ${resetAt}
        )
      ON CONFLICT (key)
      DO UPDATE SET
        attempts =
          CASE
            WHEN rate_limits.reset_at <= ${now}
              THEN 1
            ELSE rate_limits.attempts + 1
          END,

        reset_at =
          CASE
            WHEN rate_limits.reset_at <= ${now}
              THEN ${resetAt}
            ELSE rate_limits.reset_at
          END

      RETURNING
        attempts,
        reset_at;
    `);

  const record =
    result.rows[0] as
      | {
          attempts: number;
          reset_at: Date;
        }
      | undefined;

  if (!record) {
    return {
      allowed: false,
      retryAfterMinutes:
        windowMinutes,
    };
  }

  const attempts =
    Number(record.attempts);

  if (
    attempts >
    maxAttempts
  ) {
    const diffMs =
      new Date(
        record.reset_at
      ).getTime() -
      now.getTime();

    const retryAfterMinutes =
      Math.ceil(
        diffMs /
          (1000 * 60)
      );

    return {
      allowed: false,
      retryAfterMinutes:
        Math.max(
          1,
          retryAfterMinutes
        ),
    };
  }

  return {
    allowed: true,
  };
}

async function decrementRateLimitAttempt(
  identifier: string
): Promise<void> {
  await db.execute(sql`
    UPDATE rate_limits
    SET attempts =
      GREATEST(
        0,
        attempts - 1
      )
    WHERE key = ${identifier};
  `);
}

async function clearRateLimit(
  identifier: string
): Promise<void> {
  await db
    .delete(rateLimits)
    .where(
      eq(
        rateLimits.key,
        identifier
      )
    );
}

/**
 * ============================================================
 * SESSION CREATION
 * ============================================================
 */

async function createSession(
  userId: string
): Promise<void> {
  const rawToken =
    crypto
      .randomBytes(32)
      .toString('hex');

  const tokenHash =
    crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

  const expiresAt =
    new Date(
      Date.now() +
        SESSION_MAX_AGE_SECONDS *
          1000
    );

  await db
    .insert(sessions)
    .values({
      userId,
      tokenHash,
      expiresAt,
    });

  // Housekeeping: drop this user's expired sessions and cap active
  // sessions to the most recent MAX_SESSIONS_PER_USER devices.
  await db.execute(sql`
    DELETE FROM sessions
    WHERE user_id = ${userId}
      AND (
        expires_at <= now()
        OR id NOT IN (
          SELECT id FROM sessions
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT ${MAX_SESSIONS_PER_USER}
        )
      )
  `);

  const cookieStore =
    await cookies();

  cookieStore.set(
    SESSION_COOKIE_NAME,
    rawToken,
    SESSION_COOKIE_OPTIONS
  );
}

/**
 * ============================================================
 * GET CURRENT SESSION
 * ============================================================
 */

export async function getSessionUserAction() {
  const cookieStore =
    await cookies();

  const rawToken =
    cookieStore.get(
      SESSION_COOKIE_NAME
    )?.value;

  if (!rawToken) {
    return null;
  }

  const tokenHash =
    crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

  const [activeSession] =
    await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(
            sessions.tokenHash,
            tokenHash
          ),
          gt(
            sessions.expiresAt,
            new Date()
          )
        )
      )
      .limit(1);

  if (!activeSession) {
    // This function is also called during server-component render (layout,
    // pages), where cookie mutation throws. The stale cookie is harmless —
    // its session row is already expired/gone — so a no-op here is fine;
    // it gets cleared on the next real action / route handler.
    try {
      cookieStore.delete(SESSION_COOKIE_NAME);
    } catch {
      /* not in an action/route-handler context */
    }

    return null;
  }

  // One round-trip for the user + their household.
  const [row] =
    await db
      .select({ user: users, household: households })
      .from(users)
      .leftJoin(
        households,
        eq(households.id, users.householdId)
      )
      .where(eq(users.id, activeSession.userId))
      .limit(1);

  const user = row?.user;
  const household = row?.household;

  if (!user || !household) {
    await db
      .delete(sessions)
      .where(
        eq(
          sessions.id,
          activeSession.id
        )
      );

    try {
      cookieStore.delete(SESSION_COOKIE_NAME);
    } catch {
      /* called during render — cookie can't be cleared here */
    }

    return null;
  }

  /*
   * This object is passed into client components and serialized to the
   * browser. Expose an explicit allow-list only — never the password
   * hash or raw API keys. API-key presence is surfaced as booleans;
   * server code that needs an actual key value queries `users` directly.
   */
  const hasValue = (v: unknown): boolean =>
    typeof v === 'string' && v.trim().length > 0;

  const safeUser = {
    id: user.id,
    householdId: user.householdId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    themePreference: user.themePreference,
    aiProvider: user.aiProvider,
    emailDigest: user.emailDigest ?? false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    hasAiApiKey: hasValue(user.aiApiKey),
    hasGeminiKey: hasValue(user.geminiApiKey),
    hasOpenaiKey: hasValue(user.openaiApiKey),
    hasAnthropicKey: hasValue(user.anthropicApiKey),
    hasGroqKey: hasValue(user.groqApiKey),
    hasCerebrasKey: hasValue(user.cerebrasApiKey),
    hasOpenrouterKey: hasValue(user.openrouterApiKey),
  };

  // Stocking-module store memberships (independent of the household). Empty
  // for everyone who isn't a shop member.
  const storeRows = await db
    .select({
      id: stores.id,
      name: stores.name,
      role: storeMembers.role,
    })
    .from(storeMembers)
    .innerJoin(stores, eq(stores.id, storeMembers.storeId))
    .where(eq(storeMembers.userId, user.id));

  return {
    user: safeUser,
    household,
    stores: storeRows,
  };
}

/**
 * ============================================================
 * ADD FAMILY MEMBER / SEND INVITATION
 * ============================================================
 */

export async function addFamilyMemberAction(
  formData: FormData
) {
  const session =
    await getSessionUserAction();

  if (
    !session ||
    !isOwnerOrAdmin(
      session.user.role
    )
  ) {
    return {
      success: false,
      error:
        'Unauthorized access.',
    };
  }

  const fullName =
    String(
      formData.get(
        'fullName'
      ) ?? ''
    ).trim();

  const email =
    String(
      formData.get(
        'email'
      ) ?? ''
    )
      .trim()
      .toLowerCase();

  if (!fullName || !email) {
    return {
      success: false,
      error:
        'Name and email are required.',
    };
  }

  if (fullName.length > 100) {
    return {
      success: false,
      error:
        'Full name must be 100 characters or less.',
    };
  }

  if (!EMAIL_REGEX.test(email)) {
    return {
      success: false,
      error:
        'Please enter a valid email address.',
    };
  }

  const [existingUser] =
    await db
      .select({
        id: users.id,
      })
      .from(users)
      .where(
        eq(
          users.email,
          email
        )
      )
      .limit(1);

  if (existingUser) {
    return {
      success: false,
      error:
        'A user with this email already exists.',
    };
  }

  const rawInviteToken =
    crypto
      .randomBytes(32)
      .toString('hex');

  const tokenHash =
    crypto
      .createHash('sha256')
      .update(rawInviteToken)
      .digest('hex');

  const expiresAt =
    new Date(
      Date.now() +
        1000 *
          60 *
          60 *
          48
    );

  try {
    await db
      .insert(invitations)
      .values({
        householdId:
          session.household.id,
        email,
        role: 'MEMBER',
        tokenHash,
        expiresAt,
      });
  } catch (error: unknown) {
    if (
      isPostgresError(error) &&
      error.code === '23505'
    ) {
      return {
        success: false,
        error:
          'An active invitation for this email already exists.',
      };
    }

    console.error(
      'Invitation creation failed:',
      error
    );

    return {
      success: false,
      error:
        'Failed to create invitation.',
    };
  }

  const inviteLink =
    `${getAppUrl()}/login?invite=${encodeURIComponent(
      rawInviteToken
    )}`;

  const safeFullName =
    escapeHtml(fullName);

  const safeHouseholdName =
    escapeHtml(
      session.household.name
    );

  const safeInviteLink =
    escapeHtml(inviteLink);

  const emailHtml = `
    <div style="font-family:Arial,sans-serif;background:#090d16;color:#f8fafc;padding:32px;border-radius:16px;">
      <h2 style="color:#2dd4bf;margin-top:0;">
        Welcome, ${safeFullName}!
      </h2>

      <p style="color:#cbd5e1;font-size:14px;">
        You have been invited to join
        <strong>${safeHouseholdName}</strong>
        on your financial command center.
      </p>

      <p style="color:#cbd5e1;font-size:14px;">
        Click the button below to accept your invitation
        and set up your secure password.
        This link expires in 48 hours.
      </p>

      <a
        href="${safeInviteLink}"
        style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold;margin-top:16px;"
      >
        Accept Invitation →
      </a>
    </div>
  `;

  const senderAddress =
    process.env.RESEND_FROM_EMAIL ||
    'Global Family Vault <onboarding@resend.dev>';

  try {
    const resend =
      getResendClient();

    await resend.emails.send({
      from: senderAddress,
      to: [email],
      subject:
        `Invitation to join ${session.household.name} Wealth Command Center`,
      html: emailHtml,
    });
  } catch (error: unknown) {
    console.error(
      'Resend error:',
      error
    );

    await db
      .delete(invitations)
      .where(
        eq(
          invitations.tokenHash,
          tokenHash
        )
      );

    return {
      success: false,
      error:
        'Failed to send invitation email. Please try again.',
    };
  }

  revalidatePath('/profile');

  return {
    success: true,
  };
}

/**
 * ============================================================
 * VERIFY INVITATION
 * ============================================================
 */

export async function verifyInviteTokenAction(
  rawToken: string
) {
  if (!rawToken) {
    return {
      success: false,
      error:
        'Invalid invitation link.',
    };
  }

  const tokenHash =
    crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

  const [invite] =
    await db
      .select({
        email:
          invitations.email,
        householdId:
          invitations.householdId,
        role:
          invitations.role,
        expiresAt:
          invitations.expiresAt,
      })
      .from(invitations)
      .where(
        and(
          eq(
            invitations.tokenHash,
            tokenHash
          ),
          gt(
            invitations.expiresAt,
            new Date()
          )
        )
      )
      .limit(1);

  if (!invite) {
    return {
      success: false,
      error:
        'This invitation link is invalid or has expired.',
    };
  }

  const [household] =
    await db
      .select({
        name: households.name,
      })
      .from(households)
      .where(
        eq(
          households.id,
          invite.householdId
        )
      )
      .limit(1);

  return {
    success: true,
    email: invite.email,
    householdName:
      household?.name ||
      'Family Household',
    role: invite.role,
  };
}

/**
 * ============================================================
 * ACCEPT INVITATION
 * ============================================================
 */

export async function acceptInviteAction(
  formData: FormData
) {
  const rawToken =
    String(
      formData.get(
        'token'
      ) ?? ''
    ).trim();

  const fullName =
    String(
      formData.get(
        'fullName'
      ) ?? ''
    ).trim();

  const password =
    String(
      formData.get(
        'password'
      ) ?? ''
    );

  if (
    !rawToken ||
    !fullName ||
    !password
  ) {
    return {
      success: false,
      error:
        'All fields are required.',
    };
  }

  if (fullName.length > 100) {
    return {
      success: false,
      error:
        'Full name must be 100 characters or less.',
    };
  }

  const passwordError =
    validatePassword(password);

  if (passwordError) {
    return {
      success: false,
      error: passwordError,
    };
  }

  const tokenHash =
    crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

  let createdUserId:
    | string
    | null = null;

  try {
    await db.transaction(
      async (tx) => {
        const [invite] =
          await tx
            .delete(invitations)
            .where(
              and(
                eq(
                  invitations.tokenHash,
                  tokenHash
                ),
                gt(
                  invitations.expiresAt,
                  new Date()
                )
              )
            )
            .returning();

        if (!invite) {
          throw new Error(
            'This invitation link is invalid or has expired.'
          );
        }

        const passwordHash =
          await bcrypt.hash(
            password,
            BCRYPT_ROUNDS
          );

        const [user] =
          await tx
            .insert(users)
            .values({
              householdId:
                invite.householdId,
              email:
                invite.email,
              passwordHash,
              fullName,
              role:
                invite.role ||
                'MEMBER',
            })
            .returning({
              id: users.id,
            });

        createdUserId =
          user.id;
      }
    );
  } catch (error: unknown) {
    if (
      isPostgresError(error) &&
      error.code === '23505'
    ) {
      return {
        success: false,
        error:
          'An account with this email already exists.',
      };
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to accept invitation.',
    };
  }

  if (createdUserId) {
    await createSession(
      createdUserId
    );
  }

  revalidatePath('/');

  return {
    success: true,
  };
}

/* ============================================================
   AUTH / SESSION
   ============================================================ */

/**
 * Returns the currently authenticated user and household.
 *
 * Authentication is based on the httpOnly `vault_session` cookie, whose
 * value is a random token; its SHA-256 hash is looked up in the `sessions`
 * table (see getSessionUserAction / createSession above).
 *
 * This is the single source of truth for sessions — `@/actions/vault`
 * re-exports getSessionUserAction/loginAction/logoutAction from here.
 *
 * No middleware.js is required for this approach.
 */

/**
 * Login
 */
export async function loginAction(formData: FormData) {
  try {
    const email = String(formData.get('email') || '')
      .trim()
      .toLowerCase();

    const password = String(formData.get('password') || '');

    if (!email || !password) {
      return {
        success: false,
        error: 'Please enter both email and password.',
      };
    }

    /*
     * Brute-force protection. Limit attempts per client IP and per
     * target email within a rolling 15-minute window. A successful
     * login clears the email counter and refunds the IP attempt
     * (see below), so a legitimate user who mistypes is not locked out.
     */
    const clientIp = await getClientIp();
    const ipRateKey = `login:ip:${clientIp}`;
    const emailRateKey = `login:email:${email}`;

    const ipRate = await checkAndIncrementRateLimit(ipRateKey, 20, 15);
    if (!ipRate.allowed) {
      return {
        success: false,
        error:
          'Too many sign-in attempts from this device. Please wait a few minutes and try again.',
      };
    }

    const emailRate = await checkAndIncrementRateLimit(emailRateKey, 5, 15);
    if (!emailRate.allowed) {
      return {
        success: false,
        error:
          'Too many sign-in attempts for this account. Please wait a few minutes and try again.',
      };
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      // Spend the same time a real bcrypt check would, then fail generically.
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return {
        success: false,
        error: INVALID_CREDENTIALS_ERROR,
      };
    }

    const isBcryptHash =
      user.passwordHash.startsWith('$2a$') ||
      user.passwordHash.startsWith('$2b$') ||
      user.passwordHash.startsWith('$2y$');

    if (!user.passwordHash || !isBcryptHash) {
      /*
       * No usable bcrypt password: an invite that was never completed,
       * or a legacy plaintext record. Equalize timing, then fail — the
       * account must go through password reset.
       */
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);

      return {
        success: false,
        error: INVALID_CREDENTIALS_ERROR,
      };
    }

    const isValid = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!isValid) {
      return {
        success: false,
        error: INVALID_CREDENTIALS_ERROR,
      };
    }

    /*
     * Make sure the user's household still exists.
     */
    const [household] = await db
      .select()
      .from(households)
      .where(eq(households.id, user.householdId))
      .limit(1);

    if (!household) {
      return {
        success: false,
        error: 'Your household account could not be found.',
      };
    }

    /*
     * Create a proper server-side session record and set the
     * hashed session cookie. This must match the mechanism
     * getSessionUserAction() reads from (sessions table +
     * hashed token), not a raw user id.
     */
    await createSession(user.id);

    /*
     * Successful login: reset this account's brute-force counter and
     * refund the IP attempt this request consumed, without wiping the
     * IP's wider history.
     */
    await Promise.all([
      clearRateLimit(emailRateKey),
      decrementRateLimitAttempt(ipRateKey),
    ]);

    /*
     * Revalidate dashboard.
     */
    revalidatePath('/');
    revalidatePath('/login');

    return {
      success: true,
      role: user.role,
    };
  } catch (error) {
    logError('loginAction', error);

    return {
      success: false,
      error: 'Unable to sign in right now. Please try again.',
    };
  }
}

/* ============================================================
   FAMILY MEMBERS / INVITES
   ============================================================ */

export async function sendInviteEmail(
  toEmail: string,
  householdName: string,
  inviteCode?: string
) {
  try {
    const response =
      await resend.emails.send({
        from:
          process.env.RESEND_FROM_EMAIL ||
          'Global Family Vault <onboarding@resend.dev>',

        to: [toEmail],

        subject:
          `Welcome to ${householdName} Wealth Command Center`,

        html: `
          <div style="font-family: Arial, sans-serif; background-color: #090d16; color: #f8fafc; padding: 32px; border-radius: 16px;">

            <h2 style="color: #818cf8; margin-top: 0;">
              Global Family Vault Invitation
            </h2>

            <p style="color: #cbd5e1; font-size: 14px;">
              You have been invited to collaborate on the
              <strong>${householdName}</strong>
              wealth command center.
            </p>

            ${
              inviteCode
                ? `
                  <p style="color: #cbd5e1; font-size: 14px;">
                    Your household invite code is:
                  </p>

                  <div style="background-color: #1e293b; border: 1px solid #334155; padding: 16px; border-radius: 12px; margin: 20px 0; text-align: center;">
                    <span style="font-size: 22px; font-weight: bold; color: #38bdf8; letter-spacing: 2px;">
                      ${inviteCode}
                    </span>
                  </div>
                `
                : ''
            }

            <a
              href="${getAppUrl()}/login"
              style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: bold; margin-top: 10px;"
            >
              Access Wealth Vault →
            </a>

          </div>
        `,
      });

    if (response.error) {
      return {
        success: false,
        error: response.error,
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error,
    };
  }
}

/**
 * ============================================================
 * LOGOUT
 * ============================================================
 */

export async function logoutAction() {
  const cookieStore =
    await cookies();

  const rawToken =
    cookieStore.get(
      SESSION_COOKIE_NAME
    )?.value;

  if (rawToken) {
    const tokenHash =
      crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

    await db
      .delete(sessions)
      .where(
        eq(
          sessions.tokenHash,
          tokenHash
        )
      );
  }

  cookieStore.delete(
    SESSION_COOKIE_NAME
  );

  // Re-render the root layout so the (now unauthenticated) session is
  // reflected and layout-level UI like the AI chat unmounts.
  revalidatePath('/', 'layout');

  redirect('/login');
}

/**
 * Revoke every session for the current user except the one making this
 * request ("sign out other devices"). Also called after a password change.
 */
export async function revokeOtherSessionsAction() {
  const session = await getSessionUserAction();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const currentHash = rawToken
    ? crypto.createHash('sha256').update(rawToken).digest('hex')
    : null;

  const deleted = await db
    .delete(sessions)
    .where(
      currentHash
        ? and(
            eq(sessions.userId, session.user.id),
            ne(sessions.tokenHash, currentHash),
          )
        : eq(sessions.userId, session.user.id),
    )
    .returning({ id: sessions.id });

  return { success: true, count: deleted.length };
}

/**
 * Permanently delete the current user's account after a password
 * re-confirmation. If they are the household's last member the whole
 * household is removed (cascading its data); if they are the last
 * owner-tier account but other members remain, deletion is refused.
 */
export async function deleteAccountAction(formData: FormData) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const password = String(formData.get('password') || '');
  if (!password) return { success: false, error: 'Enter your password to confirm.' };

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user) return { success: false, error: 'Account not found.' };

  const isBcrypt = /^\$2[aby]\$/.test(user.passwordHash);
  const ok = isBcrypt ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!ok) return { success: false, error: 'Incorrect password.' };

  const householdId = session.household.id;
  const members = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.householdId, householdId));
  const others = members.filter((m) => m.id !== user.id);
  const otherOwners = others.filter((m) => ['SUPER_ADMIN', 'OWNER'].includes(m.role));

  if (
    others.length > 0 &&
    otherOwners.length === 0 &&
    ['SUPER_ADMIN', 'OWNER'].includes(user.role)
  ) {
    return {
      success: false,
      error: 'You are the only owner. Promote another member to owner before deleting your account.',
    };
  }

  await logAudit({
    actorUserId: user.id,
    actorEmail: user.email,
    householdId,
    action: 'account.delete',
    targetType: 'user',
    targetId: user.id,
    meta: { removedHousehold: others.length === 0 },
  });

  if (others.length === 0) {
    await db.delete(households).where(eq(households.id, householdId));
  } else {
    await db.delete(users).where(eq(users.id, user.id));
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  revalidatePath('/', 'layout');
  redirect('/login');
}

/**
 * ============================================================
 * REGISTER HOUSEHOLD OWNER
 * ============================================================
 */

export async function registerOwnerAction(
  formData: FormData
) {
  const clientIp =
    await getClientIp();

  const ipKey =
    `register-owner:ip:${clientIp}`;

  const ipCheck =
    await checkAndIncrementRateLimit(
      ipKey,
      5,
      15
    );

  if (!ipCheck.allowed) {
    return {
      success: false,
      error:
        'Too many household creation attempts. Please try again later.',
    };
  }

  const fullName =
    String(
      formData.get(
        'fullName'
      ) ?? ''
    ).trim();

  const householdName =
    String(
      formData.get(
        'householdName'
      ) ?? ''
    ).trim();

  const email =
    String(
      formData.get(
        'email'
      ) ?? ''
    )
      .trim()
      .toLowerCase();

  const password =
    String(
      formData.get(
        'password'
      ) ?? ''
    );

  const baseCurrency =
    String(
      formData.get(
        'baseCurrency'
      ) ?? 'USD'
    ).trim() ||
    'USD';

  if (
    !fullName ||
    !householdName ||
    !email ||
    !password
  ) {
    await decrementRateLimitAttempt(
      ipKey
    );

    return {
      success: false,
      error:
        'All fields are required.',
    };
  }

  if (fullName.length > 100) {
    await decrementRateLimitAttempt(
      ipKey
    );

    return {
      success: false,
      error:
        'Full name must be 100 characters or less.',
    };
  }

  if (householdName.length > 150) {
    await decrementRateLimitAttempt(
      ipKey
    );

    return {
      success: false,
      error:
        'Household name must be 150 characters or less.',
    };
  }

  if (!EMAIL_REGEX.test(email)) {
    await decrementRateLimitAttempt(
      ipKey
    );

    return {
      success: false,
      error:
        'Please enter a valid email address.',
    };
  }

  const passwordError =
    validatePassword(password);

  if (passwordError) {
    await decrementRateLimitAttempt(
      ipKey
    );

    return {
      success: false,
      error: passwordError,
    };
  }

  const bytes =
    crypto.randomBytes(16);

  const hex =
    bytes
      .toString('hex')
      .toUpperCase();

  const chunks =
    hex.match(/.{1,4}/g) ||
    [];

  const inviteCode =
    `FAM-${chunks
      .slice(0, 4)
      .join('-')}`;

  let createdUserId:
    | string
    | null = null;

  const userRole =
    'OWNER';

  try {
    await db.transaction(
      async (tx) => {
        const [household] =
          await tx
            .insert(households)
            .values({
              name: householdName,
              baseCurrency,
              inviteCode,
            })
            .returning({
              id: households.id,
            });

        const passwordHash =
          await bcrypt.hash(
            password,
            BCRYPT_ROUNDS
          );

        const [user] =
          await tx
            .insert(users)
            .values({
              householdId:
                household.id,
              email,
              passwordHash,
              fullName,
              role: userRole,
            })
            .returning({
              id: users.id,
            });

        createdUserId =
          user.id;
      }
    );
  } catch (error: unknown) {
    await decrementRateLimitAttempt(
      ipKey
    );

    if (
      isPostgresError(error) &&
      error.code === '23505'
    ) {
      return {
        success: false,
        error:
          'An account with this email already exists.',
      };
    }

    console.error(
      'Household registration failed:',
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to register household.',
    };
  }

  if (createdUserId) {
    await decrementRateLimitAttempt(
      ipKey
    );

    await createSession(
      createdUserId
    );
  }

  revalidatePath('/');

  return {
    success: true,
    role: userRole,
  };
}

/**
 * ============================================================
 * REGISTER MEMBER WITH HOUSEHOLD CODE
 * ============================================================
 */

export async function registerMemberWithCodeAction(
  formData: FormData
) {
  const clientIp =
    await getClientIp();

  const ipKey =
    `register-code:ip:${clientIp}`;

  const ipCheck =
    await checkAndIncrementRateLimit(
      ipKey,
      10,
      15
    );

  if (!ipCheck.allowed) {
    return {
      success: false,
      error:
        'Too many registration attempts. Please try again later.',
    };
  }

  const fullName =
    String(
      formData.get(
        'fullName'
      ) ?? ''
    ).trim();

  const inviteCode =
    String(
      formData.get(
        'inviteCode'
      ) ?? ''
    )
      .trim()
      .toUpperCase();

  const email =
    String(
      formData.get(
        'email'
      ) ?? ''
    )
      .trim()
      .toLowerCase();

  const password =
    String(
      formData.get(
        'password'
      ) ?? ''
    );

  if (
    !fullName ||
    !inviteCode ||
    !email ||
    !password
  ) {
    await decrementRateLimitAttempt(
      ipKey
    );

    return {
      success: false,
      error:
        'All fields are required.',
    };
  }

  if (fullName.length > 100) {
    await decrementRateLimitAttempt(
      ipKey
    );

    return {
      success: false,
      error:
        'Full name must be 100 characters or less.',
    };
  }

  if (!EMAIL_REGEX.test(email)) {
    await decrementRateLimitAttempt(
      ipKey
    );

    return {
      success: false,
      error:
        'Please enter a valid email address.',
    };
  }

  const passwordError =
    validatePassword(password);

  if (passwordError) {
    await decrementRateLimitAttempt(
      ipKey
    );

    return {
      success: false,
      error: passwordError,
    };
  }

  const [household] =
    await db
      .select({
        id: households.id,
      })
      .from(households)
      .where(
        eq(
          households.inviteCode,
          inviteCode
        )
      )
      .limit(1);

  if (!household) {
    await decrementRateLimitAttempt(
      ipKey
    );

    return {
      success: false,
      error:
        'Invalid household invite code.',
    };
  }

  let createdUserId:
    | string
    | null = null;

  const userRole =
    'MEMBER';

  try {
    await db.transaction(
      async (tx) => {
        const passwordHash =
          await bcrypt.hash(
            password,
            BCRYPT_ROUNDS
          );

        const [user] =
          await tx
            .insert(users)
            .values({
              householdId:
                household.id,
              email,
              passwordHash,
              fullName,
              role: userRole,
            })
            .returning({
              id: users.id,
            });

        createdUserId =
          user.id;
      }
    );
  } catch (error: unknown) {
    await decrementRateLimitAttempt(
      ipKey
    );

    if (
      isPostgresError(error) &&
      error.code === '23505'
    ) {
      return {
        success: false,
        error:
          'An account with this email already exists.',
      };
    }

    console.error(
      'Member registration failed:',
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to join household.',
    };
  }

  if (createdUserId) {
    await decrementRateLimitAttempt(
      ipKey
    );

    await createSession(
      createdUserId
    );
  }

  revalidatePath('/');

  return {
    success: true,
    role: userRole,
  };
}

/**
 * ============================================================
 * ROTATE HOUSEHOLD INVITE CODE
 * ============================================================
 */

export async function rotateHouseholdInviteCodeAction() {
  const session =
    await getSessionUserAction();

  if (
    !session ||
    !isOwnerOrSuperAdmin(
      session.user.role
    )
  ) {
    return {
      success: false,
      error:
        'Unauthorized action.',
    };
  }

  const bytes =
    crypto.randomBytes(16);

  const hex =
    bytes
      .toString('hex')
      .toUpperCase();

  const chunks =
    hex.match(/.{1,4}/g) ||
    [];

  const newInviteCode =
    `FAM-${chunks
      .slice(0, 4)
      .join('-')}`;

  await db
    .update(households)
    .set({
      inviteCode:
        newInviteCode,
      updatedAt:
        new Date(),
    })
    .where(
      eq(
        households.id,
        session.household.id
      )
    );

  revalidatePath('/profile');

  return {
    success: true,
    inviteCode:
      newInviteCode,
  };
}

/**
 * ============================================================
 * UPDATE PASSWORD
 * ============================================================
 */

export async function updatePasswordAction(
  formData: FormData
) {
  const session =
    await getSessionUserAction();

  if (!session) {
    return {
      success: false,
      error: 'Unauthorized',
    };
  }

  const clientIp =
    await getClientIp();

  const rateLimitKey =
    `change-password:${session.user.id}:${clientIp}`;

  const rateCheck =
    await checkAndIncrementRateLimit(
      rateLimitKey,
      5,
      15
    );

  if (!rateCheck.allowed) {
    return {
      success: false,
      error:
        'Too many password change attempts. Please try again later.',
    };
  }

  const currentPassword =
    String(
      formData.get(
        'currentPassword'
      ) ?? ''
    );

  const newPassword =
    String(
      formData.get(
        'newPassword'
      ) ?? ''
    );

  if (
    !currentPassword ||
    !newPassword
  ) {
    await decrementRateLimitAttempt(
      rateLimitKey
    );

    return {
      success: false,
      error:
        'Please fill in both current and new passwords.',
    };
  }

  const passwordError =
    validatePassword(
      newPassword
    );

  if (passwordError) {
    await decrementRateLimitAttempt(
      rateLimitKey
    );

    return {
      success: false,
      error: passwordError,
    };
  }

  const [user] =
    await db
      .select({
        id: users.id,
        passwordHash:
          users.passwordHash,
      })
      .from(users)
      .where(
        eq(
          users.id,
          session.user.id
        )
      )
      .limit(1);

  if (!user) {
    await decrementRateLimitAttempt(
      rateLimitKey
    );

    return {
      success: false,
      error:
        'User not found.',
    };
  }

  const isValid =
    await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

  if (!isValid) {
    return {
      success: false,
      error:
        'Incorrect current password.',
    };
  }

  const newPasswordHash =
    await bcrypt.hash(
      newPassword,
      BCRYPT_ROUNDS
    );

  await db.transaction(
    async (tx) => {
      await tx
        .update(users)
        .set({
          passwordHash:
            newPasswordHash,
          updatedAt:
            new Date(),
        })
        .where(
          eq(
            users.id,
            session.user.id
          )
        );

      await tx
        .delete(sessions)
        .where(
          eq(
            sessions.userId,
            user.id
          )
        );
    }
  );

  await clearRateLimit(
    rateLimitKey
  );

  await createSession(
    session.user.id
  );

  revalidatePath('/profile');

  return {
    success: true,
  };
}

/**
 * ============================================================
 * REQUEST PASSWORD RESET
 * ============================================================
 */

export async function requestPasswordResetAction(
  formData: FormData
) {
  const email =
    String(
      formData.get(
        'email'
      ) ?? ''
    )
      .trim()
      .toLowerCase();

  const clientIp =
    await getClientIp();

  /**
   * Always return success to prevent
   * account enumeration.
   */
  if (!EMAIL_REGEX.test(email)) {
    return {
      success: true,
    };
  }

  const ipKey =
    `reset:ip:${clientIp}`;

  const emailKey =
    `reset:email:${email}`;

  const ipLimit =
    await checkAndIncrementRateLimit(
      ipKey,
      5,
      20
    );

  const emailLimit =
    await checkAndIncrementRateLimit(
      emailKey,
      3,
      20
    );

  if (
    !ipLimit.allowed ||
    !emailLimit.allowed
  ) {
    /**
     * Undo whichever counter was incremented
     * successfully so failed combined checks
     * don't consume attempts.
     */
    if (ipLimit.allowed) {
      await decrementRateLimitAttempt(
        ipKey
      );
    }

    if (emailLimit.allowed) {
      await decrementRateLimitAttempt(
        emailKey
      );
    }

    return {
      success: true,
    };
  }

  const [user] =
    await db
      .select({
        id: users.id,
        fullName:
          users.fullName,
        email: users.email,
      })
      .from(users)
      .where(
        eq(
          users.email,
          email
        )
      )
      .limit(1);

  if (user) {
    const rawToken =
      crypto
        .randomBytes(32)
        .toString('hex');

    const tokenHash =
      crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

    const expiresAt =
      new Date(
        Date.now() +
          1000 *
            60 *
            20
      );

    await db
      .delete(passwordResets)
      .where(
        eq(
          passwordResets.userId,
          user.id
        )
      );

    await db
      .insert(passwordResets)
      .values({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

    const resetLink =
      `${getAppUrl()}/login?reset-token=${encodeURIComponent(
        rawToken
      )}`;

    const safeName =
      escapeHtml(
        user.fullName
      );

    const safeLink =
      escapeHtml(
        resetLink
      );

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;background:#090d16;color:#f8fafc;padding:32px;border-radius:16px;">
        <h2 style="color:#2dd4bf;margin-top:0;">
          Password Reset Request
        </h2>

        <p style="color:#cbd5e1;font-size:14px;">
          Hello ${safeName},
        </p>

        <p style="color:#cbd5e1;font-size:14px;">
          We received a request to reset your password
          for your financial command center.
          Click the button below to choose a new password.
          This link expires in 20 minutes.
        </p>

        <a
          href="${safeLink}"
          style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold;margin-top:16px;"
        >
          Reset Password →
        </a>

        <p style="color:#64748b;font-size:12px;margin-top:24px;">
          If you did not request this reset, you can safely
          ignore this email.
        </p>
      </div>
    `;

    try {
      const resend =
        getResendClient();

      await resend.emails.send({
        from:
          process.env.RESEND_FROM_EMAIL ||
          'Global Family Vault <onboarding@resend.dev>',
        to: [email],
        subject:
          'Reset your password',
        html: emailHtml,
      });
    } catch (error: unknown) {
      console.error(
        'Password reset email dispatch failed:',
        error
      );

      await db
        .delete(passwordResets)
        .where(
          eq(
            passwordResets.tokenHash,
            tokenHash
          )
        );
    }
  }

  return {
    success: true,
  };
}

/**
 * ============================================================
 * VERIFY PASSWORD RESET TOKEN
 * ============================================================
 */

export async function verifyResetTokenAction(
  rawToken: string
) {
  if (!rawToken) {
    return {
      success: false,
      error:
        'Invalid reset link.',
    };
  }

  const tokenHash =
    crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

  const [resetRecord] =
    await db
      .select({
        id:
          passwordResets.id,
      })
      .from(passwordResets)
      .where(
        and(
          eq(
            passwordResets.tokenHash,
            tokenHash
          ),
          gt(
            passwordResets.expiresAt,
            new Date()
          )
        )
      )
      .limit(1);

  if (!resetRecord) {
    return {
      success: false,
      error:
        'This password reset link is invalid or has expired.',
    };
  }

  return {
    success: true,
  };
}

/**
 * ============================================================
 * EXECUTE PASSWORD RESET
 * ============================================================
 */

export async function resetPasswordAction(
  formData: FormData
) {
  const rawToken =
    String(
      formData.get(
        'token'
      ) ?? ''
    ).trim();

  const newPassword =
    String(
      formData.get(
        'password'
      ) ?? ''
    );

  if (
    !rawToken ||
    !newPassword
  ) {
    return {
      success: false,
      error:
        'All fields are required.',
    };
  }

  const passwordError =
    validatePassword(
      newPassword
    );

  if (passwordError) {
    return {
      success: false,
      error: passwordError,
    };
  }

  const clientIp =
    await getClientIp();

  const rateLimitKey =
    `reset-execute:${clientIp}`;

  const rateCheck =
    await checkAndIncrementRateLimit(
      rateLimitKey,
      10,
      15
    );

  if (!rateCheck.allowed) {
    return {
      success: false,
      error:
        'Too many password reset attempts. Please try again later.',
    };
  }

  const tokenHash =
    crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

  let targetUserId:
    | string
    | null = null;

  try {
    await db.transaction(
      async (tx) => {
        const [resetRecord] =
          await tx
            .delete(passwordResets)
            .where(
              and(
                eq(
                  passwordResets.tokenHash,
                  tokenHash
                ),
                gt(
                  passwordResets.expiresAt,
                  new Date()
                )
              )
            )
            .returning({
              userId:
                passwordResets.userId,
            });

        if (!resetRecord) {
          throw new Error(
            'This password reset link is invalid or has expired.'
          );
        }

        targetUserId =
          resetRecord.userId;

        const passwordHash =
          await bcrypt.hash(
            newPassword,
            BCRYPT_ROUNDS
          );

        await tx
          .update(users)
          .set({
            passwordHash,
            updatedAt:
              new Date(),
          })
          .where(
            eq(
              users.id,
              targetUserId
            )
          );

        await tx
          .delete(sessions)
          .where(
            eq(
              sessions.userId,
              targetUserId
            )
          );
      }
    );
  } catch (error: unknown) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to reset password.',
    };
  }

  if (targetUserId) {
    await clearRateLimit(
      rateLimitKey
    );

    await createSession(
      targetUserId
    );
  }

  revalidatePath('/');

  return {
    success: true,
  };
}

/**
 * ============================================================
 * CLEANUP EXPIRED AUTH DATA
 * ============================================================
 *
 * Call this from a scheduled/server-side job.
 *
 * It is intentionally NOT called on every request.
 */

export async function cleanupExpiredAuthDataAction() {
  const session =
    await getSessionUserAction();

  if (
    !session ||
    !isSuperAdmin(
      session.user.role
    )
  ) {
    return {
      success: false,
      error:
        'Unauthorized action.',
    };
  }

  await db.execute(sql`
    DELETE FROM sessions
    WHERE expires_at <= NOW();
  `);

  await db.execute(sql`
    DELETE FROM invitations
    WHERE expires_at <= NOW();
  `);

  await db.execute(sql`
    DELETE FROM password_resets
    WHERE expires_at <= NOW();
  `);

  await db.execute(sql`
    DELETE FROM rate_limits
    WHERE reset_at <= NOW();
  `);

  return {
    success: true,
  };
}