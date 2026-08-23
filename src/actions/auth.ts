'use server';

import { db } from '@/db';
import { households, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function getSessionUserAction() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('vault_user_id')?.value;
  if (!userId) return null;

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;

  const [household] = await db.select().from(households).where(eq(households.id, user.householdId));
  return { user, household };
}

export async function fetchFamilyMembersAction() {
  const session = await getSessionUserAction();
  if (!session) return [];
  return await db.select().from(users).where(eq(users.householdId, session.household.id));
}

export async function addFamilyMemberAction(formData: FormData) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const fullName = (formData.get('fullName') as string || '').trim();
  const email = (formData.get('email') as string || '').trim();
  const role = (formData.get('role') as string || 'MEMBER').trim();

  if (!fullName || !email) {
    return { success: false, error: 'Name and email are required.' };
  }

  const [existingUser] = await db.select().from(users).where(eq(users.email, email));
  if (existingUser) {
    return { success: false, error: 'A user with this email already exists.' };
  }

  const tempPasswordHash = crypto.randomBytes(8).toString('hex');

  await db.insert(users).values({
    householdId: session.household.id,
    fullName,
    email,
    passwordHash: tempPasswordHash,
    role,
  });

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; background-color: #090d16; color: #f8fafc; padding: 32px; border-radius: 16px;">
      <h2 style="color: #818cf8; margin-top: 0;">Welcome, ${fullName}!</h2>
      <p style="color: #cbd5e1; font-size: 14px;">
        You have been added as a family member to the <strong>${session.household.name}</strong> on the Global Family Wealth & Legacy Command Center.
      </p>
      <div style="background-color: #1e293b; border: 1px solid #334155; padding: 16px; border-radius: 12px; margin: 20px 0;">
        <p style="margin: 0; font-size: 13px; color: #94a3b8;">Your Login Email:</p>
        <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: bold; color: #ffffff;">${email}</p>
      </div>
      <p style="color: #cbd5e1; font-size: 14px;">
        You can now log in to view consolidated assets, multi-currency balances, and legacy directives.
      </p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: bold; margin-top: 10px;">
        Access Wealth Vault →
      </a>
    </div>
  `;

  const senderAddress = process.env.RESEND_FROM_EMAIL || 'Global Family Vault <vault@resend.dev>';

  try {
    await resend.emails.send({
      from: senderAddress,
      to: [email],
      subject: `Welcome to ${session.household.name} Wealth Command Center`,
      html: emailHtml,
    });
  } catch (emailErr: any) {
    console.error('Resend error:', emailErr);
  }

  revalidatePath('/profile');
  return { success: true };
}

export async function loginAction(formData: FormData) {
  const email = (formData.get('email') as string || '').trim();
  const password = (formData.get('password') as string || '').trim();

  if (!email || !password) {
    return { success: false, error: 'Please enter both email and password.' };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) {
    return { success: false, error: 'No account found with this email.' };
  }

  let isValid = false;
  if (user.passwordHash.startsWith('$2a$') || user.passwordHash.startsWith('$2b$')) {
    isValid = await bcrypt.compare(password, user.passwordHash);
  } else {
    isValid = user.passwordHash === password;
  }

  if (!isValid) {
    return { success: false, error: 'Incorrect password.' };
  }

  const cookieStore = await cookies();
  cookieStore.set('vault_user_id', user.id, { path: '/' });

  revalidatePath('/');
  return { success: true, role: user.role };
}

export async function registerOwnerAction(formData: FormData) {
  const fullName = (formData.get('fullName') as string || '').trim();
  const householdName = (formData.get('householdName') as string || '').trim();
  const email = (formData.get('email') as string || '').trim();
  const password = (formData.get('password') as string || '').trim();
  const baseCurrency = (formData.get('baseCurrency') as string || 'USD').trim();

  // Terminal inspection log to see exactly what arrives from the form
  console.log('--- REGISTER OWNER DEBUG PAYLOAD ---', {
    fullName: `"${fullName}"`,
    householdName: `"${householdName}"`,
    email: `"${email}"`,
    passwordLength: password.length,
    baseCurrency: `"${baseCurrency}"`
  });

  if (!fullName || !householdName || !email || !password) {
    return { success: false, error: 'All fields are required.' };
  }

  const [existingUser] = await db.select().from(users).where(eq(users.email, email));
  if (existingUser) {
    return { success: false, error: 'An account with this email already exists.' };
  }

  const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();

  const [household] = await db.insert(households).values({
    name: householdName,
    baseCurrency,
    inviteCode,
  } as any).returning();

  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db.insert(users).values({
    householdId: household.id,
    email,
    passwordHash,
    fullName,
    role: 'OWNER',
  }).returning();

  const cookieStore = await cookies();
  cookieStore.set('vault_user_id', user.id, { path: '/' });

  revalidatePath('/');
  return { success: true, role: user.role };
}

export async function registerMemberWithCodeAction(formData: FormData) {
  const fullName = (formData.get('fullName') as string || '').trim();
  const inviteCode = (formData.get('inviteCode') as string || '').trim();
  const email = (formData.get('email') as string || '').trim();
  const password = (formData.get('password') as string || '').trim();

  if (!fullName || !inviteCode || !email || !password) {
    return { success: false, error: 'All fields are required.' };
  }

  const [household] = await db.select().from(households).where(eq((households as any).inviteCode, inviteCode));
  if (!household) {
    return { success: false, error: 'Invalid household invite code.' };
  }

  const [existingUser] = await db.select().from(users).where(eq(users.email, email));
  if (existingUser) {
    return { success: false, error: 'An account with this email already exists.' };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db.insert(users).values({
    householdId: household.id,
    email,
    passwordHash,
    fullName,
    role: 'MEMBER',
  }).returning();

  const cookieStore = await cookies();
  cookieStore.set('vault_user_id', user.id, { path: '/' });

  revalidatePath('/');
  return { success: true, role: user.role };
}

export async function updatePasswordAction(formData: FormData) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const currentPassword = (formData.get('currentPassword') as string || '').trim();
  const newPassword = (formData.get('newPassword') as string || '').trim();

  if (!currentPassword || !newPassword) {
    return { success: false, error: 'Please fill in both current and new passwords.' };
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
  if (!user) return { success: false, error: 'User not found.' };

  let isValid = false;
  if (user.passwordHash.startsWith('$2a$') || user.passwordHash.startsWith('$2b$')) {
    isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  } else {
    isValid = user.passwordHash === currentPassword;
  }

  if (!isValid) {
    return { success: false, error: 'Incorrect current password.' };
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ passwordHash: newPasswordHash, updatedAt: new Date() }).where(eq(users.id, user.id));

  revalidatePath('/profile');
  return { success: true };
}

export async function deleteFamilyMemberAction(memberId: string) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const [targetUser] = await db.select().from(users).where(eq(users.id, memberId));
  if (!targetUser) return { success: false, error: 'User not found' };

  if (targetUser.id === session!.user.id) {
    return { success: false, error: 'You cannot remove your own account from the household.' };
  }

  if (targetUser.householdId !== session!.household.id) {
    return { success: false, error: 'Unauthorized action.' };
  }

  await db.delete(users).where(eq(users.id, memberId));

  revalidatePath('/profile');
  return { success: true };
}