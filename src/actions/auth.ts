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
} from '@/db/schema';

import {
  and,
  eq,
  gt,
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

/**
 * ============================================================
 * CONSTANTS
 * ============================================================
 */

const SESSION_COOKIE_NAME = 'vault_session';

const SESSION_MAX_AGE_SECONDS =
  60 * 60 * 24 * 30; // 30 days

const SESSION_COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: SESSION_MAX_AGE_SECONDS,
  priority: 'high' as const,
};

const BCRYPT_ROUNDS = 12;

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PROVIDERS = [
  'gemini',
  'openai',
  'anthropic',
  'groq',
  'openrouter',
] as const;

type SupportedProvider =
  (typeof PROVIDERS)[number];

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

/**
 * ============================================================
 * APPLICATION URL
 * ============================================================
 */

function getAppUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL;

  if (!configuredUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'NEXT_PUBLIC_APP_URL is not configured.'
      );
    }

    return 'http://localhost:3000';
  }

  let parsed: URL;

  try {
    parsed = new URL(configuredUrl);
  } catch {
    throw new Error(
      'NEXT_PUBLIC_APP_URL is invalid.'
    );
  }

  if (
    process.env.NODE_ENV === 'production' &&
    parsed.protocol !== 'https:'
  ) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL must use HTTPS in production.'
    );
  }

  return parsed
    .toString()
    .replace(/\/$/, '');
}

/**
 * ============================================================
 * ENCRYPTION
 * ============================================================
 *
 * Format:
 *
 * v1:iv:authTag:ciphertext
 *
 * AES-256-GCM
 */

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (
    !key ||
    !/^[0-9a-fA-F]{64}$/.test(key)
  ) {
    throw new Error(
      'ENCRYPTION_KEY must be a valid 64-character hex string.'
    );
  }

  return Buffer.from(key, 'hex');
}

function encrypt(text: string): string {
  if (!text) {
    return '';
  }

  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    iv
  );

  let encrypted =
    cipher.update(
      text,
      'utf8',
      'hex'
    );

  encrypted += cipher.final('hex');

  const tag =
    cipher.getAuthTag();

  return [
    'v1',
    iv.toString('hex'),
    tag.toString('hex'),
    encrypted,
  ].join(':');
}

function decrypt(text: string): string {
  if (!text) {
    return '';
  }

  const parts =
    text.split(':');

  if (parts.length !== 4) {
    throw new Error(
      'Invalid encrypted value format.'
    );
  }

  const [
    version,
    ivHex,
    tagHex,
    encryptedText,
  ] = parts;

  if (version !== 'v1') {
    throw new Error(
      'Unsupported encryption version.'
    );
  }

  if (
    !/^[0-9a-fA-F]{32}$/.test(
      ivHex
    ) ||
    !/^[0-9a-fA-F]{32}$/.test(
      tagHex
    ) ||
    !/^[0-9a-fA-F]*$/.test(
      encryptedText
    )
  ) {
    throw new Error(
      'Invalid encrypted value structure.'
    );
  }

  const iv =
    Buffer.from(ivHex, 'hex');

  const tag =
    Buffer.from(tagHex, 'hex');

  const decipher =
    crypto.createDecipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
      iv
    );

  decipher.setAuthTag(tag);

  let decrypted =
    decipher.update(
      encryptedText,
      'hex',
      'utf8'
    );

  decrypted +=
    decipher.final('utf8');

  return decrypted;
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
    cookieStore.delete(
      SESSION_COOKIE_NAME
    );

    return null;
  }

  const [user] =
    await db
      .select({
        id: users.id,
        householdId:
          users.householdId,
        email: users.email,
        fullName:
          users.fullName,
        role: users.role,
        themePreference:
          users.themePreference,
        aiProvider:
          users.aiProvider,
      })
      .from(users)
      .where(
        eq(
          users.id,
          activeSession.userId
        )
      )
      .limit(1);

  if (!user) {
    await db
      .delete(sessions)
      .where(
        eq(
          sessions.id,
          activeSession.id
        )
      );

    cookieStore.delete(
      SESSION_COOKIE_NAME
    );

    return null;
  }

  const [household] =
    await db
      .select({
        id: households.id,
        name: households.name,
        baseCurrency:
          households.baseCurrency,
        inviteCode:
          households.inviteCode,
      })
      .from(households)
      .where(
        eq(
          households.id,
          user.householdId
        )
      )
      .limit(1);

  if (!household) {
    await db
      .delete(sessions)
      .where(
        eq(
          sessions.id,
          activeSession.id
        )
      );

    cookieStore.delete(
      SESSION_COOKIE_NAME
    );

    return null;
  }

  return {
    user,
    household,
  };
}

/**
 * ============================================================
 * SERVER-SIDE AI API KEY
 * ============================================================
 */

export async function getServerAiApiKey(): Promise<
  string | null
> {
  const session =
    await getSessionUserAction();

  if (!session) {
    return null;
  }

  const [user] =
    await db
      .select({
        aiApiKey:
          users.aiApiKey,
      })
      .from(users)
      .where(
        eq(
          users.id,
          session.user.id
        )
      )
      .limit(1);

  if (!user?.aiApiKey) {
    return null;
  }

  try {
    return decrypt(
      user.aiApiKey
    );
  } catch (error) {
    console.error(
      'Failed to decrypt API key:',
      error
    );

    return null;
  }
}

/**
 * ============================================================
 * FAMILY MEMBERS
 * ============================================================
 */

export async function fetchFamilyMembersAction() {
  const session =
    await getSessionUserAction();

  if (!session) {
    return [];
  }

  return await db
    .select({
      id: users.id,
      fullName:
        users.fullName,
      email: users.email,
      role: users.role,
      householdId:
        users.householdId,
      createdAt:
        users.createdAt,
    })
    .from(users)
    .where(
      eq(
        users.householdId,
        session.household.id
      )
    );
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
    'Global Family Vault <vault@resend.dev>';

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

/**
 * ============================================================
 * LOGIN
 * ============================================================
 */

'use server';

import { db } from '@/db';
import {
  households,
  users,
  portfolios,
  assets,
  transactions,
  draftLineItems,
  documents,
} from '@/db/schema';

import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { GoogleGenAI, Type } from '@google/genai';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Resend } from 'resend';

const resend = new Resend(
  process.env.RESEND_API_KEY || 're_placeholder'
);

/* ============================================================
   SESSION CONFIGURATION
   ============================================================ */

const SESSION_COOKIE_NAME = 'vault_user_id';

const SESSION_COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

/* ============================================================
   AUTH / SESSION
   ============================================================ */

/**
 * Returns the currently authenticated user and household.
 *
 * Authentication is based on the httpOnly vault_user_id cookie.
 *
 * No middleware.js is required for this approach.
 */
export async function getSessionUserAction() {
  try {
    const cookieStore = await cookies();

    const userId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!userId) {
      return null;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      // Remove stale/invalid cookie.
      cookieStore.delete(SESSION_COOKIE_NAME);
      return null;
    }

    const [household] = await db
      .select()
      .from(households)
      .where(eq(households.id, user.householdId))
      .limit(1);

    if (!household) {
      // User exists but household no longer exists.
      cookieStore.delete(SESSION_COOKIE_NAME);
      return null;
    }

    return {
      user,
      household,
    };
  } catch (error) {
    console.error('getSessionUserAction error:', error);
    return null;
  }
}

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

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return {
        success: false,
        error: 'No account found with this email.',
      };
    }

    if (!user.passwordHash) {
      return {
        success: false,
        error: 'This account does not have a valid password.',
      };
    }

    let isValid = false;

    /*
     * Support bcrypt passwords.
     */
    if (
      user.passwordHash.startsWith('$2a$') ||
      user.passwordHash.startsWith('$2b$') ||
      user.passwordHash.startsWith('$2y$')
    ) {
      isValid = await bcrypt.compare(
        password,
        user.passwordHash
      );
    } else {
      /*
       * Legacy plaintext password support.
       *
       * This is intentionally retained so an existing account
       * can still log in. After successful login, upgrade it
       * automatically to bcrypt.
       */
      isValid = user.passwordHash === password;

      if (isValid) {
        const upgradedHash = await bcrypt.hash(password, 12);

        await db
          .update(users)
          .set({
            passwordHash: upgradedHash,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));
      }
    }

    if (!isValid) {
      return {
        success: false,
        error: 'Incorrect password.',
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
     * Set authentication cookie.
     *
     * This is the cookie DashboardPage -> getSessionUserAction()
     * uses to determine whether the user is logged in.
     */
    const cookieStore = await cookies();

    cookieStore.set(
      SESSION_COOKIE_NAME,
      user.id,
      SESSION_COOKIE_OPTIONS
    );

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
    console.error('loginAction error:', error);

    return {
      success: false,
      error: 'Unable to sign in right now. Please try again.',
    };
  }
}

/**
 * Logout
 */
export async function logoutAction() {
  const cookieStore = await cookies();

  cookieStore.delete(SESSION_COOKIE_NAME);

  redirect('/login');
}

/* ============================================================
   REGISTRATION
   ============================================================ */

export async function registerOwnerAction(formData: FormData) {
  try {
    const fullName = String(
      formData.get('fullName') || ''
    ).trim();

    const householdName = String(
      formData.get('householdName') || ''
    ).trim();

    const email = String(
      formData.get('email') || ''
    )
      .trim()
      .toLowerCase();

    const password = String(
      formData.get('password') || ''
    );

    const baseCurrency = String(
      formData.get('baseCurrency') || 'USD'
    ).trim();

    if (
      !fullName ||
      !householdName ||
      !email ||
      !password
    ) {
      return {
        success: false,
        error: 'All fields are required.',
      };
    }

    if (password.length < 8) {
      return {
        success: false,
        error: 'Password must be at least 8 characters.',
      };
    }

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      return {
        success: false,
        error: 'An account with this email already exists.',
      };
    }

    const inviteCode = crypto
      .randomBytes(4)
      .toString('hex')
      .toUpperCase();

    const [household] = await db
      .insert(households)
      .values({
        name: householdName,
        baseCurrency,
        inviteCode,
      } as any)
      .returning();

    if (!household) {
      return {
        success: false,
        error: 'Failed to create household.',
      };
    }

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    const [user] = await db
      .insert(users)
      .values({
        householdId: household.id,
        email,
        passwordHash,
        fullName,
        role: 'OWNER',
      })
      .returning();

    if (!user) {
      return {
        success: false,
        error: 'Failed to create user account.',
      };
    }

    /*
     * Automatically authenticate newly registered owner.
     */
    const cookieStore = await cookies();

    cookieStore.set(
      SESSION_COOKIE_NAME,
      user.id,
      SESSION_COOKIE_OPTIONS
    );

    revalidatePath('/');

    return {
      success: true,
      role: user.role,
    };
  } catch (error) {
    console.error(
      'registerOwnerAction error:',
      error
    );

    return {
      success: false,
      error: 'Unable to create household. Please try again.',
    };
  }
}

/* ============================================================
   MEMBER REGISTRATION
   ============================================================ */

export async function registerMemberWithCodeAction(
  formData: FormData
) {
  try {
    const fullName = String(
      formData.get('fullName') || ''
    ).trim();

    const inviteCode = String(
      formData.get('inviteCode') || ''
    )
      .trim()
      .toUpperCase();

    const email = String(
      formData.get('email') || ''
    )
      .trim()
      .toLowerCase();

    const password = String(
      formData.get('password') || ''
    );

    if (
      !fullName ||
      !inviteCode ||
      !email ||
      !password
    ) {
      return {
        success: false,
        error: 'All fields are required.',
      };
    }

    if (password.length < 8) {
      return {
        success: false,
        error: 'Password must be at least 8 characters.',
      };
    }

    const [household] = await db
      .select()
      .from(households)
      .where(
        eq(
          households.inviteCode as any,
          inviteCode
        )
      )
      .limit(1);

    if (!household) {
      return {
        success: false,
        error: 'Invalid household invite code.',
      };
    }

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      return {
        success: false,
        error: 'An account with this email already exists.',
      };
    }

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    const [user] = await db
      .insert(users)
      .values({
        householdId: household.id,
        email,
        passwordHash,
        fullName,
        role: 'MEMBER',
      })
      .returning();

    if (!user) {
      return {
        success: false,
        error: 'Failed to create member account.',
      };
    }

    const cookieStore = await cookies();

    cookieStore.set(
      SESSION_COOKIE_NAME,
      user.id,
      SESSION_COOKIE_OPTIONS
    );

    revalidatePath('/');

    return {
      success: true,
      role: user.role,
    };
  } catch (error) {
    console.error(
      'registerMemberWithCodeAction error:',
      error
    );

    return {
      success: false,
      error: 'Unable to join household. Please try again.',
    };
  }
}

/* ============================================================
   PASSWORD
   ============================================================ */

export async function updatePasswordAction(
  formData: FormData
) {
  const session = await getSessionUserAction();

  if (!session) {
    return {
      success: false,
      error: 'Unauthorized',
    };
  }

  const currentPassword = String(
    formData.get('currentPassword') || ''
  );

  const newPassword = String(
    formData.get('newPassword') || ''
  );

  if (!currentPassword || !newPassword) {
    return {
      success: false,
      error:
        'Please fill in both current and new passwords.',
    };
  }

  if (newPassword.length < 8) {
    return {
      success: false,
      error:
        'New password must be at least 8 characters.',
    };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    return {
      success: false,
      error: 'User not found.',
    };
  }

  let isValid = false;

  if (
    user.passwordHash.startsWith('$2a$') ||
    user.passwordHash.startsWith('$2b$') ||
    user.passwordHash.startsWith('$2y$')
  ) {
    isValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );
  } else {
    isValid =
      user.passwordHash === currentPassword;
  }

  if (!isValid) {
    return {
      success: false,
      error: 'Incorrect current password.',
    };
  }

  const newPasswordHash = await bcrypt.hash(
    newPassword,
    12
  );

  await db
    .update(users)
    .set({
      passwordHash: newPasswordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return {
    success: true,
  };
}

/* ============================================================
   USER API KEY
   ============================================================ */

export async function updateUserApiKeyAction(
  apiKey: string
) {
  try {
    const session =
      await getSessionUserAction();

    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Unauthorized',
      };
    }

    await db
      .update(users)
      .set({
        aiApiKey: apiKey,
        updatedAt: new Date(),
      } as any)
      .where(eq(users.id, session.user.id));

    revalidatePath('/profile');

    return {
      success: true,
    };
  } catch (error: any) {
    return {
      success: false,
      error:
        error?.message ||
        'Failed to save API key',
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
          'Global Family Vault <vault@resend.dev>',

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
              href="${
                process.env.NEXT_PUBLIC_APP_URL ||
                'http://localhost:3000'
              }/login"
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

export async function fetchFamilyMembersAction() {
  const session =
    await getSessionUserAction();

  if (!session) {
    return [];
  }

  return await db
    .select()
    .from(users)
    .where(
      eq(
        users.householdId,
        session.household.id
      )
    );
}

export async function addFamilyMemberAction(
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

  const fullName = String(
    formData.get('fullName') || ''
  ).trim();

  const email = String(
    formData.get('email') || ''
  )
    .trim()
    .toLowerCase();

  const role = String(
    formData.get('role') || 'MEMBER'
  ).trim();

  if (!fullName || !email) {
    return {
      success: false,
      error: 'Name and email are required.',
    };
  }

  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    return {
      success: false,
      error:
        'A user with this email already exists.',
    };
  }

  /*
   * Generate a random temporary password.
   */
  const temporaryPassword =
    crypto.randomBytes(12).toString('base64url');

  const tempPasswordHash =
    await bcrypt.hash(
      temporaryPassword,
      12
    );

  await db.insert(users).values({
    householdId:
      session.household.id,
    fullName,
    email,
    passwordHash: tempPasswordHash,
    role,
  });

  const emailResult =
    await sendInviteEmail(
      email,
      session.household.name,
      session.household.inviteCode ||
        undefined
    );

  if (!emailResult.success) {
    return {
      success: false,
      error:
        `User added, but email failed: ${JSON.stringify(
          emailResult.error
        )}`,
    };
  }

  revalidatePath('/profile');

  return {
    success: true,
  };
}

export async function deleteFamilyMemberAction(
  memberId: string
) {
  const session =
    await getSessionUserAction();

  if (!session) {
    return {
      success: false,
      error: 'Unauthorized',
    };
  }

  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, memberId))
    .limit(1);

  if (!targetUser) {
    return {
      success: false,
      error: 'User not found',
    };
  }

  if (
    targetUser.id === session.user.id
  ) {
    return {
      success: false,
      error:
        'You cannot remove your own account from the household.',
    };
  }

  if (
    targetUser.householdId !==
    session.household.id
  ) {
    return {
      success: false,
      error: 'Unauthorized action.',
    };
  }

  await db
    .delete(users)
    .where(eq(users.id, memberId));

  revalidatePath('/profile');

  return {
    success: true,
  };
}

/* ============================================================
   EXCHANGE RATES
   ============================================================ */

let cachedRates: {
  rates: Record<string, number>;
  fetchedAt: number;
} | null = null;

const CACHE_TTL_MS =
  60 * 60 * 1000;

export async function fetchLiveExchangeRatesAction(): Promise<
  Record<string, number>
> {
  const now = Date.now();

  if (
    cachedRates &&
    now - cachedRates.fetchedAt <
      CACHE_TTL_MS
  ) {
    return cachedRates.rates;
  }

  try {
    const res = await fetch(
      'https://api.frankfurter.app/latest?from=USD',
      {
        next: {
          revalidate: 3600,
        },
      }
    );

    if (!res.ok) {
      throw new Error(
        'FX fetch failed'
      );
    }

    const data =
      await res.json();

    const rates: Record<
      string,
      number
    > = {
      USD: 1,
      ...data.rates,
    };

    cachedRates = {
      rates,
      fetchedAt: now,
    };

    return rates;
  } catch (error) {
    console.error(
      'Live FX fetch failed:',
      error
    );

    return {
      USD: 1,
      EUR: 0.93,
      GBP: 0.78,
      CAD: 1.35,
      AUD: 1.54,
      INR: 83.3,
      JPY: 149.3,
      CHF: 0.89,
      CNY: 6.71,
    };
  }
}

export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  if (
    fromCurrency === toCurrency
  ) {
    return 1;
  }

  const rates =
    await fetchLiveExchangeRatesAction();

  const rateFrom =
    rates[fromCurrency] || 1;

  const rateTo =
    rates[toCurrency] || 1;

  return rateTo / rateFrom;
}

/* ============================================================
   MARKET PRICES
   ============================================================ */

export async function refreshLiveMarketPricesAction() {
  const session =
    await getSessionUserAction();

  if (!session) {
    return {
      success: false,
      error: 'Unauthorized',
    };
  }

  const householdAssets =
    await db
      .select()
      .from(assets)
      .where(
        eq(
          assets.householdId,
          session.household.id
        )
      );

  let updatedCount = 0;

  const fiatTickers = [
    'USD',
    'EUR',
    'GBP',
    'CAD',
    'AUD',
    'INR',
    'JPY',
    'CHF',
    'CNY',
    'USDT_FIAT',
  ];

  for (
    const asset of householdAssets
  ) {
    const assetType =
      (asset.assetType || '')
        .toUpperCase()
        .trim();

    const ticker =
      (asset.ticker || '')
        .toUpperCase()
        .trim();

    if (
      !ticker ||
      assetType === 'CASH' ||
      fiatTickers.includes(ticker)
    ) {
      continue;
    }

    let livePrice:
      | number
      | null = null;

    try {
      if (
        assetType === 'CRYPTO' ||
        [
          'BTC',
          'ETH',
          'SOL',
          'USDT',
          'BNB',
          'ADA',
          'XRP',
        ].includes(ticker)
      ) {
        const coinMap: Record<
          string,
          string
        > = {
          BTC: 'bitcoin',
          ETH: 'ethereum',
          SOL: 'solana',
          ADA: 'cardano',
          XRP: 'ripple',
        };

        const coinId =
          coinMap[ticker] ||
          ticker.toLowerCase();

        const res =
          await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
            {
              next: {
                revalidate: 60,
              },
            }
          );

        const data =
          await res.json();

        livePrice =
          data[coinId]?.usd ||
          null;
      } else {
        const res =
          await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d`,
            {
              headers: {
                'User-Agent':
                  'Mozilla/5.0',
              },
              next: {
                revalidate: 60,
              },
            }
          );

        const data =
          await res.json();

        livePrice =
          data?.chart
            ?.result?.[0]
            ?.meta
            ?.regularMarketPrice ||
          null;
      }

      if (
        livePrice !== null &&
        livePrice > 0
      ) {
        const qty =
          parseFloat(
            asset.quantity &&
              asset.quantity.trim() !== ''
              ? asset.quantity
              : '1'
          ) || 1;

        const newTotalValue =
          (
            qty * livePrice
          ).toString();

        await db
          .update(assets)
          .set({
            nativeValue:
              newTotalValue,
            updatedAt:
              new Date(),
          })
          .where(
            eq(
              assets.id,
              asset.id
            )
          );

        updatedCount++;
      }
    } catch (error) {
      console.error(
        `Failed to fetch live price for ${ticker}:`,
        error
      );
    }
  }

  revalidatePath('/');

  return {
    success: true,
    updatedCount,
  };
}

/* ============================================================
   NET WORTH
   ============================================================ */

export async function fetchNetWorthTrendAction(
  range: string = '6m'
) {
  try {
    const session =
      await getSessionUserAction();

    if (!session) {
      return [];
    }

    const householdAssets =
      await db
        .select()
        .from(assets)
        .where(
          eq(
            assets.householdId,
            session.household.id
          )
        );

    if (
      householdAssets.length === 0
    ) {
      return [];
    }

    let currentTotal = 0;

    for (
      const asset of householdAssets
    ) {
      const fx =
        await getExchangeRate(
          asset.nativeCurrency ||
            'USD',
          session.household
            .baseCurrency
        );

      const value =
        parseFloat(
          asset.nativeValue || '0'
        ) * fx;

      const type =
        (asset.assetType || '')
          .toUpperCase();

      const category =
        (asset.accountCategory ||
          '')
          .toUpperCase();

      if (
        type === 'LIABILITY' ||
        type === 'DEBT' ||
        category === 'LIABILITY' ||
        category === 'DEBT'
      ) {
        currentTotal -=
          Math.abs(value);
      } else {
        currentTotal +=
          Math.abs(value);
      }
    }

    let totalPoints = 6;

    switch (range) {
      case '1m':
        totalPoints = 4;
        break;
      case '3m':
        totalPoints = 3;
        break;
      case '6m':
        totalPoints = 6;
        break;
      case '1y':
        totalPoints = 12;
        break;
      case '3y':
        totalPoints = 36;
        break;
      case '5y':
        totalPoints = 60;
        break;
      case '10y':
        totalPoints = 120;
        break;
      case '15y':
        totalPoints = 180;
        break;
      case '20y':
        totalPoints = 240;
        break;
      default:
        totalPoints = 6;
    }

    const now = new Date();

    const periods: {
      date: Date;
      key: string;
      label: string;
    }[] = [];

    for (
      let i = totalPoints - 1;
      i >= 0;
      i--
    ) {
      const d =
        new Date(
          now.getFullYear(),
          now.getMonth() -
            i +
            1,
          0
        );

      const key =
        `${d.getFullYear()}-${String(
          d.getMonth() + 1
        ).padStart(2, '0')}`;

      const label =
        totalPoints > 12
          ? i % 12 === 0
            ? `${d.getFullYear()}`
            : ''
          : d.toLocaleString(
              'default',
              {
                month: 'short',
                year: '2-digit',
              }
            );

      periods.push({
        date: d,
        key,
        label,
      });
    }

    const assetIds =
      householdAssets.map(
        (asset) => asset.id
      );

    const allTransactions =
      await db
        .select()
        .from(transactions)
        .orderBy(
          transactions.transactionDate
        );

    if (
      allTransactions.length ===
      0
    ) {
      return periods.map(
        (
          period,
          index,
          array
        ) => {
          const factor =
            0.95 +
            0.05 *
              (index /
                Math.max(
                  array.length - 1,
                  1
                ));

          return {
            month:
              period.label ||
              period.key,
            value: Math.round(
              currentTotal *
                factor
            ),
          };
        }
      );
    }

    const results = [];

    for (
      const period of periods
    ) {
      const latestAssetValues: Record<
        string,
        number
      > = {};

      for (
        const tx of allTransactions
      ) {
        if (
          !assetIds.includes(
            tx.assetId
          )
        ) {
          continue;
        }

        const txDate =
          new Date(
            tx.transactionDate
          );

        if (
          txDate <=
          period.date
        ) {
          const txValue =
            parseFloat(
              tx.nativePrice ||
                '0'
            ) *
            parseFloat(
              tx.fxRateToBaseOnDate ||
                '1'
            );

          latestAssetValues[
            tx.assetId
          ] = txValue;
        }
      }

      const assetKeys =
        Object.keys(
          latestAssetValues
        );

      let periodTotal =
        assetKeys.length > 0
          ? Object.values(
              latestAssetValues
            ).reduce(
              (a, b) => a + b,
              0
            )
          : currentTotal *
            0.95;

      if (
        periodTotal >
          currentTotal * 1.5 ||
        periodTotal <= 0
      ) {
        periodTotal =
          currentTotal * 0.98;
      }

      results.push({
        month:
          period.label ||
          period.key,
        value:
          Math.round(
            periodTotal
          ),
      });
    }

    if (
      results.length > 0
    ) {
      results[
        results.length - 1
      ].value =
        Math.round(
          currentTotal
        );
    }

    return results;
  } catch (error) {
    console.error(
      'fetchNetWorthTrendAction error:',
      error
    );

    return [];
  }
}

/* ============================================================
   AI STATEMENT PARSING
   ============================================================ */

async function generateWithRetry(
  ai: GoogleGenAI,
  params: any,
  retries = 5,
  delay = 5000
): Promise<any> {
  try {
    return await ai.models.generateContent(
      params
    );
  } catch (error: any) {
    const status =
      error?.status ||
      error?.code;

    const message =
      error?.message || '';

    const isRateLimitedOrOverloaded =
      status === 429 ||
      status === 503 ||
      message.includes('429') ||
      message.includes('503') ||
      message.includes(
        'RESOURCE_EXHAUSTED'
      ) ||
      message.includes(
        'overloaded'
      );

    if (
      retries > 0 &&
      isRateLimitedOrOverloaded
    ) {
      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            delay
          )
      );

      return generateWithRetry(
        ai,
        params,
        retries - 1,
        delay * 2
      );
    }

    throw error;
  }
}

export async function parseStatementAction(
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

  const files =
    formData.getAll(
      'files'
    ) as File[];

  const pastedText =
    String(
      formData.get(
        'pastedText'
      ) || ''
    ).trim();

  if (
    (!files ||
      files.length === 0) &&
    !pastedText
  ) {
    return {
      success: false,
      error:
        'No files uploaded or text provided',
    };
  }

  const apiKey =
    session.user.aiApiKey ||
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error:
        'Gemini API key is not configured. Add it in your profile settings or .env',
    };
  }

  const ai =
    new GoogleGenAI({
      apiKey,
    });

  let totalCount = 0;

  const extractionPrompt = `
Extract all investment assets, stock holdings, crypto positions, mutual funds, cash balances, and real estate line items from the provided text or document.

CRITICAL INSTRUCTIONS:

1. Always extract the exact number of shares, units, or tokens as the quantity.
2. Do not default to 1 if shares or units are listed.
3. Extract the price per unit.
4. Extract the total native value.
5. Detect the correct native currency.
6. Do not invent values.
7. If a value is not present, leave it blank rather than guessing.
`;

  /* -------------------------
     PASTED TEXT
     ------------------------- */

  if (pastedText) {
    try {
      const response =
        await generateWithRetry(
          ai,
          {
            model:
              'gemini-2.5-flash',

            contents: [
              {
                text:
                  `${extractionPrompt}\n\nHere is the pasted statement text:\n${pastedText}`,
              },
            ],

            config: {
              responseMimeType:
                'application/json',

              responseSchema: {
                type: Type.ARRAY,

                items: {
                  type: Type.OBJECT,

                  properties: {
                    assetName: {
                      type: Type.STRING,
                    },

                    ticker: {
                      type: Type.STRING,
                    },

                    assetType: {
                      type: Type.STRING,
                    },

                    accountCategory: {
                      type: Type.STRING,
                    },

                    accountNumber: {
                      type: Type.STRING,
                    },

                    rationale: {
                      type: Type.STRING,
                    },

                    quantity: {
                      type: Type.STRING,
                    },

                    pricePerUnit: {
                      type: Type.STRING,
                    },

                    totalNativeValue: {
                      type: Type.STRING,
                    },

                    nativeCurrency: {
                      type: Type.STRING,
                    },
                  },

                  required: [
                    'assetName',
                    'assetType',
                    'totalNativeValue',
                    'nativeCurrency',
                  ],
                },
              },
            },
          }
        );

      const parsedItems =
        JSON.parse(
          response.text ||
            '[]'
        );

      for (
        const item of parsedItems
      ) {
        await db
          .insert(
            draftLineItems
          )
          .values({
            householdId:
              session.household
                .id,

            userId:
              session.user.id,

            assetName:
              item.assetName,

            ticker:
              item.ticker ||
              null,

            assetType:
              (
                item.assetType ||
                'OTHER'
              )
                .toUpperCase()
                .trim(),

            accountCategory:
              item.accountCategory ||
              'INDIVIDUAL',

            accountNumber:
              item.accountNumber ||
              'DEFAULT',

            rationale:
              item.rationale ||
              'General Long-Term Growth',

            quantity:
              item.quantity
                ? item.quantity.toString()
                : '1',

            pricePerUnit:
              item.pricePerUnit
                ? item.pricePerUnit.toString()
                : item.totalNativeValue.toString(),

            totalNativeValue:
              item.totalNativeValue.toString(),

            nativeCurrency:
              item.nativeCurrency ||
              'USD',

            status:
              'PENDING',
          });

        totalCount++;
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error?.message ||
          'Failed to parse pasted text',
      };
    }
  }

  /* -------------------------
     FILES
     ------------------------- */

  for (
    const file of files
  ) {
    if (
      !file ||
      file.size === 0
    ) {
      continue;
    }

    try {
      const bytes =
        await file.arrayBuffer();

      const buffer =
        Buffer.from(bytes);

      const mimeType =
        file.type ||
        'application/pdf';

      const response =
        await generateWithRetry(
          ai,
          {
            model:
              'gemini-2.5-flash',

            contents: [
              {
                inlineData: {
                  mimeType,
                  data:
                    buffer.toString(
                      'base64'
                    ),
                },
              },

              {
                text:
                  extractionPrompt,
              },
            ],

            config: {
              responseMimeType:
                'application/json',

              responseSchema: {
                type: Type.ARRAY,

                items: {
                  type: Type.OBJECT,

                  properties: {
                    assetName: {
                      type: Type.STRING,
                    },

                    ticker: {
                      type: Type.STRING,
                    },

                    assetType: {
                      type: Type.STRING,
                    },

                    accountCategory: {
                      type: Type.STRING,
                    },

                    accountNumber: {
                      type: Type.STRING,
                    },

                    rationale: {
                      type: Type.STRING,
                    },

                    quantity: {
                      type: Type.STRING,
                    },

                    pricePerUnit: {
                      type: Type.STRING,
                    },

                    totalNativeValue: {
                      type: Type.STRING,
                    },

                    nativeCurrency: {
                      type: Type.STRING,
                    },
                  },

                  required: [
                    'assetName',
                    'assetType',
                    'totalNativeValue',
                    'nativeCurrency',
                  ],
                },
              },
            },
          }
        );

      const parsedItems =
        JSON.parse(
          response.text ||
            '[]'
        );

      for (
        const item of parsedItems
      ) {
        await db
          .insert(
            draftLineItems
          )
          .values({
            householdId:
              session.household
                .id,

            userId:
              session.user.id,

            assetName:
              item.assetName,

            ticker:
              item.ticker ||
              null,

            assetType:
              (
                item.assetType ||
                'OTHER'
              )
                .toUpperCase()
                .trim(),

            accountCategory:
              item.accountCategory ||
              'INDIVIDUAL',

            accountNumber:
              item.accountNumber ||
              'DEFAULT',

            rationale:
              item.rationale ||
              'General Long-Term Growth',

            quantity:
              item.quantity
                ? item.quantity.toString()
                : '1',

            pricePerUnit:
              item.pricePerUnit
                ? item.pricePerUnit.toString()
                : item.totalNativeValue.toString(),

            totalNativeValue:
              item.totalNativeValue.toString(),

            nativeCurrency:
              item.nativeCurrency ||
              'USD',

            status:
              'PENDING',
          });

        totalCount++;
      }

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            1000
          )
      );
    } catch (error: any) {
      console.error(
        `Error parsing file ${file.name}:`,
        error
      );
    }
  }

  revalidatePath('/');

  return {
    success: true,
    count: totalCount,
  };
}

/* ============================================================
   DRAFT LINE ITEMS
   ============================================================ */

export async function fetchDraftLineItemsAction() {
  const session =
    await getSessionUserAction();

  if (!session) {
    return [];
  }

  return await db
    .select()
    .from(draftLineItems)
    .where(
      and(
        eq(
          draftLineItems.householdId,
          session.household.id
        ),
        eq(
          draftLineItems.status,
          'PENDING'
        )
      )
    );
}

export async function approveDraftLineItemAction(
  draftId: string,
  selectedCategory?: string,
  selectedUserId?: string,
  selectedAccountNumber?: string,
  selectedRationale?: string
) {
  const session =
    await getSessionUserAction();

  if (!session) {
    return {
      success: false,
      error: 'Unauthorized',
    };
  }

  const [draft] =
    await db
      .select()
      .from(draftLineItems)
      .where(
        and(
          eq(
            draftLineItems.id,
            draftId
          ),
          eq(
            draftLineItems.householdId,
            session.household.id
          )
        )
      )
      .limit(1);

  if (!draft) {
    return {
      success: false,
      error: 'Draft not found',
    };
  }

  const targetUserId =
    selectedUserId ||
    draft.userId ||
    session.user.id;

  /*
   * Security check:
   * selected user must belong to the same household.
   */
  const [targetUser] =
    await db
      .select()
      .from(users)
      .where(
        and(
          eq(
            users.id,
            targetUserId
          ),
          eq(
            users.householdId,
            session.household.id
          )
        )
      )
      .limit(1);

  if (!targetUser) {
    return {
      success: false,
      error:
        'Selected user does not belong to this household.',
    };
  }

  const finalCategory =
    selectedCategory ||
    draft.accountCategory ||
    'INDIVIDUAL';

  const finalAccountNumber =
    selectedAccountNumber ||
    draft.accountNumber ||
    'DEFAULT';

  const finalRationale =
    selectedRationale ||
    draft.rationale ||
    'General Long-Term Growth';

  const finalAssetType =
    (
      draft.assetType ||
      'OTHER'
    )
      .toUpperCase()
      .trim();

  let [existingAsset] =
    draft.ticker
      ? await db
          .select()
          .from(assets)
          .where(
            and(
              eq(
                assets.userId,
                targetUserId
              ),
              eq(
                assets.accountNumber,
                finalAccountNumber
              ),
              eq(
                assets.ticker,
                draft.ticker
              )
            )
          )
          .limit(1)
      : [];

  if (!existingAsset) {
    [existingAsset] =
      await db
        .select()
        .from(assets)
        .where(
          and(
            eq(
              assets.userId,
              targetUserId
            ),
            eq(
              assets.accountNumber,
              finalAccountNumber
            ),
            eq(
              assets.name,
              draft.assetName
            )
          )
        )
        .limit(1);
  }

  const fxRate =
    await getExchangeRate(
      draft.nativeCurrency,
      session.household
        .baseCurrency
    );

  let targetAssetId: string;

  if (existingAsset) {
    await db
      .update(assets)
      .set({
        nativeValue:
          draft.totalNativeValue,

        quantity:
          draft.quantity ||
          existingAsset.quantity,

        accountCategory:
          finalCategory,

        rationale:
          finalRationale,

        assetType:
          finalAssetType,

        updatedAt:
          new Date(),
      })
      .where(
        eq(
          assets.id,
          existingAsset.id
        )
      );

    targetAssetId =
      existingAsset.id;
  } else {
    let [portfolio] =
      await db
        .select()
        .from(portfolios)
        .where(
          eq(
            portfolios.userId,
            targetUserId
          )
        )
        .limit(1);

    if (!portfolio) {
      [portfolio] =
        await db
          .insert(portfolios)
          .values({
            householdId:
              session.household
                .id,

            userId:
              targetUserId,

            name:
              'Portfolio',

            isHouseholdVisible:
              true,
          })
          .returning();
    }

    const [newAsset] =
      await db
        .insert(assets)
        .values({
          householdId:
            session.household
              .id,

          userId:
            targetUserId,

          portfolioId:
            portfolio.id,

          name:
            draft.assetName,

          ticker:
            draft.ticker,

          assetType:
            finalAssetType,

          accountCategory:
            finalCategory,

          accountNumber:
            finalAccountNumber,

          rationale:
            finalRationale,

          nativeCurrency:
            draft.nativeCurrency,

          quantity:
            draft.quantity ||
            '1',

          nativeValue:
            draft.totalNativeValue,
        })
        .returning();

    targetAssetId =
      newAsset.id;
  }

  await db
    .insert(transactions)
    .values({
      assetId:
        targetAssetId,

      type:
        'STATEMENT_IMPORT',

      quantity:
        draft.quantity ||
        '1',

      nativePrice:
        draft.pricePerUnit ||
        draft.totalNativeValue,

      nativeCurrency:
        draft.nativeCurrency,

      fxRateToBaseOnDate:
        fxRate.toFixed(6),

      transactionDate:
        new Date(),
    });

  await db
    .delete(draftLineItems)
    .where(
      eq(
        draftLineItems.id,
        draftId
      )
    );

  revalidatePath('/');

  return {
    success: true,
  };
}

export async function approveAllDraftLineItemsAction(
  bulkUserId?: string
) {
  const session =
    await getSessionUserAction();

  if (!session) {
    return {
      success: false,
      error: 'Unauthorized',
    };
  }

  if (bulkUserId) {
    const [targetUser] =
      await db
        .select()
        .from(users)
        .where(
          and(
            eq(
              users.id,
              bulkUserId
            ),
            eq(
              users.householdId,
              session.household.id
            )
          )
        )
        .limit(1);

    if (!targetUser) {
      return {
        success: false,
        error:
          'Selected user does not belong to this household.',
      };
    }
  }

  const drafts =
    await db
      .select()
      .from(draftLineItems)
      .where(
        and(
          eq(
            draftLineItems.householdId,
            session.household.id
          ),
          eq(
            draftLineItems.status,
            'PENDING'
          )
        )
      );

  for (
    const draft of drafts
  ) {
    await approveDraftLineItemAction(
      draft.id,
      undefined,
      bulkUserId
    );
  }

  revalidatePath('/');

  return {
    success: true,
    count: drafts.length,
  };
}

export async function rejectDraftLineItemAction(
  draftId: string
) {
  const session =
    await getSessionUserAction();

  if (!session) {
    return {
      success: false,
      error: 'Unauthorized',
    };
  }

  await db
    .delete(draftLineItems)
    .where(
      and(
        eq(
          draftLineItems.id,
          draftId
        ),
        eq(
          draftLineItems.householdId,
          session.household.id
        )
      )
    );

  revalidatePath('/');

  return {
    success: true,
  };
}

/* ============================================================
   ASSETS
   ============================================================ */

export async function addAssetAction(
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

  const name =
    String(
      formData.get('name') ||
        ''
    ).trim();

  const ticker =
    String(
      formData.get('ticker') ||
        ''
    ).trim();

  const assetType =
    (
      String(
        formData.get(
          'assetType'
        ) || 'OTHER'
      )
    )
      .toUpperCase()
      .trim();

  const accountCategory =
    String(
      formData.get(
        'accountCategory'
      ) || 'INDIVIDUAL'
    );

  const accountNumber =
    String(
      formData.get(
        'accountNumber'
      ) || 'DEFAULT'
    );

  const rationale =
    String(
      formData.get(
        'rationale'
      ) ||
        'General Long-Term Growth'
    );

  const quantity =
    String(
      formData.get(
        'quantity'
      ) || '1'
    );

  const nativeValue =
    String(
      formData.get(
        'nativeValue'
      ) || '0'
    );

  const nativeCurrency =
    String(
      formData.get(
        'nativeCurrency'
      ) || 'USD'
    );

  const requestedUserId =
    String(
      formData.get(
        'userId'
      ) ||
        session.user.id
    );

  /*
   * Do not allow adding an asset to another
   * household's user.
   */
  const [targetUser] =
    await db
      .select()
      .from(users)
      .where(
        and(
          eq(
            users.id,
            requestedUserId
          ),
          eq(
            users.householdId,
            session.household.id
          )
        )
      )
      .limit(1);

  if (!targetUser) {
    return {
      success: false,
      error:
        'Selected user does not belong to this household.',
    };
  }

  let [portfolio] =
    await db
      .select()
      .from(portfolios)
      .where(
        eq(
          portfolios.userId,
          requestedUserId
        )
      )
      .limit(1);

  if (!portfolio) {
    [portfolio] =
      await db
        .insert(portfolios)
        .values({
          householdId:
            session.household
              .id,

          userId:
            requestedUserId,

          name:
            'Portfolio',

          isHouseholdVisible:
            true,
        })
        .returning();
  }

  const [newAsset] =
    await db
      .insert(assets)
      .values({
        householdId:
          session.household
            .id,

        userId:
          requestedUserId,

        portfolioId:
          portfolio.id,

        name,

        ticker:
          ticker || null,

        assetType,

        accountCategory,

        accountNumber,

        rationale,

        nativeCurrency,

        quantity,

        nativeValue,
      })
      .returning();

  const numericQuantity =
    parseFloat(
      quantity || '1'
    ) || 1;

  const fxRate =
    await getExchangeRate(
      nativeCurrency,
      session.household
        .baseCurrency
    );

  await db
    .insert(transactions)
    .values({
      assetId:
        newAsset.id,

      type:
        'MANUAL_ADD',

      quantity,

      nativePrice:
        (
          parseFloat(
            nativeValue
          ) /
          numericQuantity
        ).toString(),

      nativeCurrency,

      fxRateToBaseOnDate:
        fxRate.toFixed(6),

      transactionDate:
        new Date(),
    });

  revalidatePath('/');

  return {
    success: true,
  };
}

export async function updateAssetAction(
  id: string,
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

  const [existing] =
    await db
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.id, id),
          eq(
            assets.householdId,
            session.household.id
          )
        )
      )
      .limit(1);

  if (!existing) {
    return {
      success: false,
      error: 'Asset not found',
    };
  }

  const nameVal =
    String(
      formData.get('name') ||
        ''
    ).trim();

  const valueVal =
    String(
      formData.get(
        'nativeValue'
      ) || ''
    );

  const rationaleVal =
    String(
      formData.get(
        'rationale'
      ) || ''
    );

  const qtyVal =
    String(
      formData.get(
        'quantity'
      ) || ''
    );

  const assetTypeVal =
    formData.get(
      'assetType'
    )
      ? String(
          formData.get(
            'assetType'
          )
        )
          .toUpperCase()
          .trim()
      : existing.assetType;

  await db
    .update(assets)
    .set({
      name:
        nameVal ||
        existing.name,

      ticker:
        formData.get(
          'ticker'
        ) !== null
          ? String(
              formData.get(
                'ticker'
              ) || ''
            ) || null
          : existing.ticker,

      assetType:
        assetTypeVal,

      accountCategory:
        String(
          formData.get(
            'accountCategory'
          ) ||
            existing.accountCategory
        ),

      accountNumber:
        String(
          formData.get(
            'accountNumber'
          ) ||
            existing.accountNumber
        ),

      rationale:
        rationaleVal ||
        existing.rationale,

      nativeCurrency:
        String(
          formData.get(
            'nativeCurrency'
          ) ||
            existing.nativeCurrency
        ),

      quantity:
        qtyVal ||
        existing.quantity,

      nativeValue:
        valueVal ||
        existing.nativeValue,

      updatedAt:
        new Date(),
    })
    .where(
      eq(
        assets.id,
        id
      )
    );

  revalidatePath('/');

  return {
    success: true,
  };
}

export async function deleteAssetAction(
  assetId: string
) {
  const session =
    await getSessionUserAction();

  if (!session) {
    return {
      success: false,
      error: 'Unauthorized',
    };
  }

  const [asset] =
    await db
      .select()
      .from(assets)
      .where(
        and(
          eq(
            assets.id,
            assetId
          ),
          eq(
            assets.householdId,
            session.household.id
          )
        )
      )
      .limit(1);

  if (!asset) {
    return {
      success: false,
      error: 'Asset not found',
    };
  }

  await db
    .delete(transactions)
    .where(
      eq(
        transactions.assetId,
        assetId
      )
    );

  await db
    .delete(assets)
    .where(
      eq(
        assets.id,
        assetId
      )
    );

  revalidatePath('/');

  return {
    success: true,
  };
}

/* ============================================================
   HOUSEHOLD SETTINGS
   ============================================================ */

export async function updateHouseholdBaseCurrencyAction(
  newCurrency: string
) {
  const session =
    await getSessionUserAction();

  if (
    !session ||
    !session.household?.id
  ) {
    return {
      success: false,
      error: 'Unauthorized',
    };
  }

  await db
    .update(households)
    .set({
      baseCurrency:
        newCurrency,
      updatedAt:
        new Date(),
    } as any)
    .where(
      eq(
        households.id,
        session.household.id
      )
    );

  revalidatePath('/');

  return {
    success: true,
  };
}

export async function updateHouseholdLegacyPillarsAction(
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

  const pillars = [];

  for (
    let i = 0;
    i < 4;
    i++
  ) {
    const name =
      String(
        formData.get(
          `pillar_name_${i}`
        ) || ''
      ).trim();

    const description =
      String(
        formData.get(
          `pillar_desc_${i}`
        ) || ''
      ).trim();

    if (name) {
      pillars.push({
        name,
        description,
      });
    }
  }

  if (
    pillars.length === 0
  ) {
    return {
      success: false,
      error:
        'At least one pillar is required.',
    };
  }

  await db
    .update(households)
    .set({
      legacyPillars:
        JSON.stringify(
          pillars
        ),

      updatedAt:
        new Date(),
    } as any)
    .where(
      eq(
        households.id,
        session.household.id
      )
    );

  revalidatePath('/');
  revalidatePath('/profile');

  return {
    success: true,
  };
}

export async function updateRetirementPreferencesAction(
  data: {
    currentAge: number;
    retirementAge: number;
    desiredIncome: number;
    country: string;
  }
) {
  const session =
    await getSessionUserAction();

  if (
    !session ||
    !session.household?.id
  ) {
    return {
      success: false,
      error: 'Unauthorized',
    };
  }

  try {
    await db
      .update(households)
      .set({
        currentAge:
          data.currentAge,

        retirementAge:
          data.retirementAge,

        desiredIncome:
          data.desiredIncome.toString(),

        retirementCountry:
          data.country,

        updatedAt:
          new Date(),
      })
      .where(
        eq(
          households.id,
          session.household.id
        )
      );

    revalidatePath('/');

    return {
      success: true,
    };
  } catch (error) {
    console.error(
      'updateRetirementPreferencesAction error:',
      error
    );

    return {
      success: false,
      error:
        'Failed to save settings',
    };
  }
}

/* ============================================================
   DOCUMENT VAULT
   ============================================================ */

function getVaultEncryptionKey(
  userId: string,
  email: string,
  householdId: string
) {
  const serverSecret =
    process.env.SESSION_SECRET ||
    'omniwealth-secure-vault-fallback-secret';

  return crypto.scryptSync(
    `${userId}:${email}:${householdId}:${serverSecret}`,
    'salt-omniwealth',
    32
  );
}

function encryptFileBuffer(
  buffer: Buffer,
  userId: string,
  email: string,
  householdId: string
): string {
  const iv =
    crypto.randomBytes(16);

  const key =
    getVaultEncryptionKey(
      userId,
      email,
      householdId
    );

  const cipher =
    crypto.createCipheriv(
      'aes-256-gcm',
      key,
      iv
    );

  const encrypted =
    Buffer.concat([
      cipher.update(buffer),
      cipher.final(),
    ]);

  const tag =
    cipher.getAuthTag();

  return Buffer.concat([
    iv,
    tag,
    encrypted,
  ]).toString('base64');
}

function decryptFileBuffer(
  encryptedBase64: string,
  userId: string,
  email: string,
  householdId: string
): Buffer {
  const data =
    Buffer.from(
      encryptedBase64,
      'base64'
    );

  const iv =
    data.subarray(0, 16);

  const tag =
    data.subarray(16, 32);

  const encrypted =
    data.subarray(32);

  const key =
    getVaultEncryptionKey(
      userId,
      email,
      householdId
    );

  const decipher =
    crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      iv
    );

  decipher.setAuthTag(
    tag
  );

  return Buffer.concat([
    decipher.update(
      encrypted
    ),
    decipher.final(),
  ]);
}

export async function fetchHouseholdDocumentsAction() {
  const session =
    await getSessionUserAction();

  if (!session) {
    return [];
  }

  return await db
    .select()
    .from(documents)
    .where(
      eq(
        documents.householdId,
        session.household.id
      )
    )
    .orderBy(
      documents.createdAt
    );
}

export async function uploadDocumentAction(
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

  const file =
    formData.get(
      'file'
    ) as File;

  if (!file) {
    return {
      success: false,
      error:
        'No file provided',
    };
  }

  const name =
    String(
      formData.get(
        'name'
      ) ||
        file.name ||
        'Untitled Document'
    );

  const assetId =
    String(
      formData.get(
        'assetId'
      ) || ''
    ) || null;

  try {
    const bytes =
      await file.arrayBuffer();

    const rawBuffer =
      Buffer.from(bytes);

    const encryptedBase64Payload =
      encryptFileBuffer(
        rawBuffer,
        session.user.id,
        session.user.email,
        session.household.id
      );

    const fileSizeMB =
      (
        file.size /
        (1024 * 1024)
      ).toFixed(2) +
      ' MB';

    await db
      .insert(documents)
      .values({
        householdId:
          session.household.id,

        userId:
          session.user.id,

        assetId,

        name,

        fileUrl:
          encryptedBase64Payload,

        fileType:
          file.type ||
          'application/pdf',

        fileSize:
          fileSizeMB,
      });

    revalidatePath('/');

    return {
      success: true,
    };
  } catch (error: any) {
    return {
      success: false,
      error:
        error?.message ||
        'Encryption/Upload failed',
    };
  }
}

export async function fetchDocumentDownloadUrlAction(
  documentId: string
) {
  const session =
    await getSessionUserAction();

  if (!session) {
    return {
      success: false,
      error: 'Unauthorized',
    };
  }

  const [doc] =
    await db
      .select()
      .from(documents)
      .where(
        and(
          eq(
            documents.id,
            documentId
          ),
          eq(
            documents.householdId,
            session.household.id
          )
        )
      )
      .limit(1);

  if (!doc) {
    return {
      success: false,
      error:
        'Document not found',
    };
  }

  try {
    const decryptedBuffer =
      decryptFileBuffer(
        doc.fileUrl,
        session.user.id,
        session.user.email,
        session.household.id
      );

    const dataUri =
      `data:${doc.fileType};base64,${decryptedBuffer.toString(
        'base64'
      )}`;

    return {
      success: true,
      dataUri,
      name: doc.name,
      fileType: doc.fileType,
    };
  } catch (error) {
    console.error(
      'Document decryption error:',
      error
    );

    return {
      success: false,
      error:
        'Decryption failed. Security context mismatch.',
    };
  }
}

export async function deleteDocumentAction(
  documentId: string
) {
  const session =
    await getSessionUserAction();

  if (!session) {
    return {
      success: false,
      error: 'Unauthorized',
    };
  }

  try {
    await db
      .delete(documents)
      .where(
        and(
          eq(
            documents.id,
            documentId
          ),
          eq(
            documents.householdId,
            session.household.id
          )
        )
      );

    revalidatePath('/');

    return {
      success: true,
    };
  } catch (error: any) {
    return {
      success: false,
      error:
        error?.message ||
        'Failed to delete document',
    };
  }
}

/* ============================================================
   THEME
   ============================================================ */

export async function updateThemePreferenceAction(
  theme: 'light' | 'dark'
) {
  const session =
    await getSessionUserAction();

  if (!session?.user?.id) {
    return {
      success: false,
      error: 'Unauthorized',
    };
  }

  try {
    await db
      .update(users)
      .set({
        themePreference:
          theme,

        updatedAt:
          new Date(),
      } as any)
      .where(
        eq(
          users.id,
          session.user.id
        )
      );

    revalidatePath('/profile');

    return {
      success: true,
    };
  } catch (error: any) {
    return {
      success: false,
      error:
        error?.message ||
        'Failed to update theme preference',
    };
  }
}    );

  if (!isValid) {
    return genericAuthError;
  }

  await decrementRateLimitAttempt(
    emailKey
  );

  await decrementRateLimitAttempt(
    ipKey
  );

  await db
    .delete(sessions)
    .where(
      and(
        eq(
          sessions.userId,
          user.id
        ),
        sql`${sessions.expiresAt} <= NOW()`
      )
    );

  await createSession(
    user.id
  );

  revalidatePath('/');

  return {
    success: true,
    role: user.role,
  };
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
 * DELETE FAMILY MEMBER
 * ============================================================
 */

export async function deleteFamilyMemberAction(
  memberId: string
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
        'Unauthorized action.',
    };
  }

  if (
    typeof memberId !== 'string' ||
    !memberId.trim()
  ) {
    return {
      success: false,
      error:
        'Invalid member ID.',
    };
  }

  const [targetUser] =
    await db
      .select({
        id: users.id,
        householdId:
          users.householdId,
        role: users.role,
      })
      .from(users)
      .where(
        eq(
          users.id,
          memberId
        )
      )
      .limit(1);

  if (!targetUser) {
    return {
      success: false,
      error:
        'User not found.',
    };
  }

  if (
    targetUser.id ===
    session.user.id
  ) {
    return {
      success: false,
      error:
        'You cannot remove your own account from the household.',
    };
  }

  if (
    targetUser.householdId !==
    session.household.id
  ) {
    return {
      success: false,
      error:
        'Unauthorized action.',
    };
  }

  if (
    targetUser.role ===
      'OWNER' &&
    !isSuperAdmin(
      session.user.role
    )
  ) {
    return {
      success: false,
      error:
        'Only a Super Admin can delete a household owner.',
    };
  }

  if (
    targetUser.role ===
      'ADMIN' &&
    !isSuperAdmin(
      session.user.role
    )
  ) {
    return {
      success: false,
      error:
        'Only a Super Admin can delete an administrator.',
    };
  }

  await db.transaction(
    async (tx) => {
      await tx
        .delete(sessions)
        .where(
          eq(
            sessions.userId,
            memberId
          )
        );

      await tx
        .delete(users)
        .where(
          eq(
            users.id,
            memberId
          )
        );
    }
  );

  revalidatePath('/profile');

  return {
    success: true,
  };
}

/**
 * ============================================================
 * UPDATE GENERIC AI API KEY
 * ============================================================
 */

export async function updateUserApiKeyAction(
  apiKey: string
) {
  try {
    const session =
      await getSessionUserAction();

    if (
      !session ||
      !session.user?.id
    ) {
      return {
        success: false,
        error: 'Unauthorized',
      };
    }

    if (
      typeof apiKey !==
        'string' ||
      apiKey.length > 500
    ) {
      return {
        success: false,
        error:
          'Invalid API key length.',
      };
    }

    const trimmedKey =
      apiKey.trim();

    if (
      trimmedKey !== '' &&
      /[\s\r\n]/.test(
        trimmedKey
      )
    ) {
      return {
        success: false,
        error:
          'Invalid API key format.',
      };
    }

    const encryptedKey =
      trimmedKey === ''
        ? null
        : encrypt(
            trimmedKey
          );

    await db
      .update(users)
      .set({
        aiApiKey:
          encryptedKey,
        updatedAt:
          new Date(),
      })
      .where(
        eq(
          users.id,
          session.user.id
        )
      );

    revalidatePath('/profile');

    return {
      success: true,
    };
  } catch (error: unknown) {
    console.error(
      'API key update failed:',
      error
    );

    return {
      success: false,
      error:
        'Failed to save API key.',
    };
  }
}

/**
 * ============================================================
 * UPDATE PROVIDER-SPECIFIC AI API KEY
 * ============================================================
 */

export async function updateProviderApiKeyAction(
  provider: string,
  apiKey: string
) {
  try {
    const session =
      await getSessionUserAction();

    if (!session) {
      return {
        success: false,
        error: 'Unauthorized',
      };
    }

    if (
      typeof provider !==
      'string'
    ) {
      return {
        success: false,
        error:
          'Invalid AI provider.',
      };
    }

    if (
      !PROVIDERS.includes(
        provider as SupportedProvider
      )
    ) {
      return {
        success: false,
        error:
          'Unsupported AI provider.',
      };
    }

    if (
      typeof apiKey !==
        'string' ||
      apiKey.length > 500
    ) {
      return {
        success: false,
        error:
          'Invalid API key length.',
      };
    }

    const trimmedKey =
      apiKey.trim();

    if (
      trimmedKey !== '' &&
      /[\s\r\n]/.test(
        trimmedKey
      )
    ) {
      return {
        success: false,
        error:
          'Invalid API key format.',
      };
    }

    const encrypted =
      trimmedKey === ''
        ? null
        : encrypt(
            trimmedKey
          );

    switch (provider) {
      case 'gemini':
        await db
          .update(users)
          .set({
            geminiApiKey:
              encrypted,
            updatedAt:
              new Date(),
          })
          .where(
            eq(
              users.id,
              session.user.id
            )
          );
        break;

      case 'openai':
        await db
          .update(users)
          .set({
            openaiApiKey:
              encrypted,
            updatedAt:
              new Date(),
          })
          .where(
            eq(
              users.id,
              session.user.id
            )
          );
        break;

      case 'anthropic':
        await db
          .update(users)
          .set({
            anthropicApiKey:
              encrypted,
            updatedAt:
              new Date(),
          })
          .where(
            eq(
              users.id,
              session.user.id
            )
          );
        break;

      case 'groq':
        await db
          .update(users)
          .set({
            groqApiKey:
              encrypted,
            updatedAt:
              new Date(),
          })
          .where(
            eq(
              users.id,
              session.user.id
            )
          );
        break;

      case 'openrouter':
        await db
          .update(users)
          .set({
            openrouterApiKey:
              encrypted,
            updatedAt:
              new Date(),
          })
          .where(
            eq(
              users.id,
              session.user.id
            )
          );
        break;

      default:
        return {
          success: false,
          error:
            'Unsupported AI provider.',
        };
    }

    revalidatePath('/profile');

    return {
      success: true,
    };
  } catch (error: unknown) {
    console.error(
      'Provider API key update failed:',
      error
    );

    return {
      success: false,
      error:
        'Failed to save API key.',
    };
  }
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
          'Global Family Vault <vault@resend.dev>',
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