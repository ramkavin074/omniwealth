'use server';

import { db } from '@/db';
import { households } from '@/db/schema';
import { getSessionUserAction } from './auth';
import { canManageHousehold, FORBIDDEN_ERROR } from '@/lib/permissions';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

// Matches the currency set offered everywhere else in the app (asset forms,
// FX fallback tables) — keep in sync if that set ever changes.
const SUPPORTED_CURRENCIES = new Set([
  'USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY',
]);

export async function updateHouseholdBaseCurrencyAction(newCurrency: string) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!canManageHousehold(session.user.role)) return { success: false, error: FORBIDDEN_ERROR };

  const currency = String(newCurrency || '').trim().toUpperCase();
  if (!SUPPORTED_CURRENCIES.has(currency)) {
    return { success: false, error: 'Unsupported currency.' };
  }

  await db.update(households).set({ baseCurrency: currency }).where(eq(households.id, session.household.id));
  revalidatePath('/');
  return { success: true };
}