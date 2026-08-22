import { db } from '@/db';
import { assets, users } from '@/db/schema';
import { getSessionUserAction, getExchangeRate } from '@/actions/vault';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import DashboardClient from '@/components/DashboardClient';

export default async function DashboardPage() {
  const session = await getSessionUserAction();

  // If not logged in, redirect straight to your login portal page
  if (!session) {
    redirect('/login');
  }

  const householdId = session.household.id;
  const baseCurrency = session.household.baseCurrency;

  const rawAssets = await db
    .select({
      id: assets.id,
      name: assets.name,
      ticker: assets.ticker,
      assetType: assets.assetType,
      accountCategory: assets.accountCategory,
      accountNumber: assets.accountNumber,
      rationale: assets.rationale,
      nativeValue: assets.nativeValue,
      nativeCurrency: assets.nativeCurrency,
      user: { fullName: users.fullName },
    })
    .from(assets)
    .leftJoin(users, eq(assets.userId, users.id))
    .where(eq(assets.householdId, householdId));

  const convertedAssets = await Promise.all(
    rawAssets.map(async (asset) => {
      const fxRate = await getExchangeRate(asset.nativeCurrency, baseCurrency);
      return { ...asset, nativeValue: parseFloat(asset.nativeValue) * fxRate };
    })
  );

  return (
    <DashboardClient 
      session={session} 
      initialAssets={convertedAssets} 
      baseCurrency={baseCurrency} 
    />
  );
}