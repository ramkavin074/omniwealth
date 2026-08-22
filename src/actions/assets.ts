'use server';

import { db } from '@/db';
import { assets, portfolios, transactions } from '@/db/schema';
import { getSessionUserAction } from './auth';
import { getExchangeRate } from '@/lib/fx';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function addAssetAction(formData: FormData) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const name = formData.get('name') as string;
  const ticker = formData.get('ticker') as string;
  const assetType = formData.get('assetType') as string;
  const accountCategory = formData.get('accountCategory') as string;
  const accountNumber = formData.get('accountNumber') as string;
  const rationale = formData.get('rationale') as string;
  const nativeValue = formData.get('nativeValue') as string;
  const nativeCurrency = formData.get('nativeCurrency') as string;
  const userId = (formData.get('userId') as string) || session.user.id;

  let [portfolio] = await db.select().from(portfolios).where(eq(portfolios.userId, userId));
  if (!portfolio) {
    [portfolio] = await db.insert(portfolios).values({
      householdId: session.household.id,
      userId,
      name: 'Portfolio',
      isHouseholdVisible: true,
    }).returning();
  }

  const [newAsset] = await db.insert(assets).values({
    householdId: session.household.id,
    userId,
    portfolioId: portfolio.id,
    name,
    ticker: ticker || null,
    assetType: assetType || 'OTHER',
    accountCategory: accountCategory || 'INDIVIDUAL',
    accountNumber: accountNumber || 'DEFAULT',
    rationale: rationale || 'General Long-Term Growth',
    nativeCurrency: nativeCurrency || 'USD',
    nativeValue,
  }).returning();

  const fxRate = await getExchangeRate(nativeCurrency || 'USD', session.household.baseCurrency);
  await db.insert(transactions).values({
    assetId: newAsset.id,
    type: 'MANUAL_ADD',
    quantity: '1',
    nativePrice: nativeValue,
    nativeCurrency: nativeCurrency || 'USD',
    fxRateToBaseOnDate: fxRate.toFixed(6),
    transactionDate: new Date(),
  });

  revalidatePath('/');
  return { success: true };
}

export async function updateAssetAction(assetId: string, formData: FormData) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  await db.update(assets).set({
    name: formData.get('name') as string,
    ticker: (formData.get('ticker') as string) || null,
    assetType: formData.get('assetType') as string,
    accountCategory: formData.get('accountCategory') as string,
    accountNumber: formData.get('accountNumber') as string,
    rationale: formData.get('rationale') as string,
    nativeValue: formData.get('nativeValue') as string,
    nativeCurrency: formData.get('nativeCurrency') as string,
    updatedAt: new Date(),
  }).where(eq(assets.id, assetId));

  revalidatePath('/');
  return { success: true };
}

export async function deleteAssetAction(assetId: string) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  await db.delete(assets).where(eq(assets.id, assetId));
  revalidatePath('/');
  return { success: true };
}