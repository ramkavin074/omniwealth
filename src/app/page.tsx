import { db } from '@/db';
import { assets, users, households } from '@/db/schema';
import { getSessionUserAction, getExchangeRate } from '@/actions/vault';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import DashboardClient from '@/components/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSessionUserAction();
  if (!session) {
    redirect('/login');
  }

  const householdId = session.household.id;

  const householdRecord = await db
    .select()
    .from(households)
    .where(eq(households.id, householdId))
    .limit(1);

  const freshHousehold = householdRecord[0] || session.household;
  const baseCurrency = freshHousehold.baseCurrency || 'USD';

  const updatedSession = {
    ...session,
    household: freshHousehold,
  };

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
      session={updatedSession} 
      initialAssets={convertedAssets} 
      baseCurrency={baseCurrency} 
    />
  );
}