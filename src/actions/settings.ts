'use server';

import { db } from '@/db';
import { households } from '@/db/schema';
import { getSessionUserAction } from './auth';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function updateHouseholdBaseCurrencyAction(newCurrency: string) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  await db.update(households).set({ baseCurrency: newCurrency }).where(eq(households.id, session.household.id));
  revalidatePath('/');
  return { success: true };
}