import { db } from '@/db';
import { assets, users, households } from '@/db/schema';
import { getSessionUserAction, fetchHouseholdDocumentsAction, fetchLiveExchangeRatesAction } from '@/actions/vault';
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

  // Pass RAW native values — do NOT convert here.
  // DashboardClient owns the one and only currency-conversion pass.
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

  const documents = await fetchHouseholdDocumentsAction();

  // Fetch live rates on the server so the first HTML byte is 100% accurate, eliminating the refresh flash.
  const initialLiveRates = await fetchLiveExchangeRatesAction();

  return (
    <DashboardClient 
      session={updatedSession} 
      initialAssets={rawAssets} 
      baseCurrency={baseCurrency} 
      initialDocuments={documents}
      initialLiveRates={initialLiveRates}
    />
  );
}