import { db } from '@/db';
import { assets, users, households } from '@/db/schema';
import { getSessionUserAction, fetchHouseholdDocumentsAction, fetchLiveExchangeRatesAction } from '@/actions/vault';
import { listScenariosAction } from '@/actions/scenarios';
import { listContactsAction, listEventsAction, listRemindersAction } from '@/actions/familyPlan';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import DashboardClient from '@/components/DashboardClient';
import CompanyLanding from '@/components/CompanyLanding';
import NativeRootRedirect from '@/components/NativeRootRedirect';
import type { Metadata } from 'next';

// The home page is the landing page for all the apps for visitors (the OmniWealth dashboard once signed in). The OmniWealth product page
// that used to be here is now /wealth; the OmniWealth phone app, which opens this address, is sent there by NativeRootRedirect.
export const metadata: Metadata = {
  title: { absolute: 'OmniWealth, Kadai and OmniKalvi: simple apps for your money, your shop and your school' },
  description:
    'Focused apps for everyday life: OmniWealth for family wealth, Kadai for shop billing and stock in Tamil and English, and OmniKalvi for school attendance, homework, notices and canteen.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'OmniWealth, Kadai and OmniKalvi',
    description: 'One app for your money, one for your shop, one for your school.',
    url: '/',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
};

export const dynamic = 'force-dynamic';
// Server actions used from this page (AI statement reader, AI CSV clean-up)
// can take a while; allow up to a minute instead of the short default.
export const maxDuration = 60;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSessionUserAction();
  if (!session) {
    return (
      <>
        <NativeRootRedirect />
        <CompanyLanding />
      </>
    );
  }
  // Store-only accounts (shop staff) have no wealth vault — send them to the
  // stocking app.
  if (session.household?.isStoreShell) {
    redirect('/stocking');
  }

  // Right after owner sign-up the login page sends people to /?welcome=1.
  const showSetup = (await searchParams).welcome === '1';

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
      quantity: assets.quantity,
      nativeValue: assets.nativeValue,
      nativeCurrency: assets.nativeCurrency,
      // Needed by Estate readiness, the Edit dialog (so saving doesn't blank them) and the stale-value nudge.
      beneficiary: assets.beneficiary,
      accessNotes: assets.accessNotes,
      createdAt: assets.createdAt,
      updatedAt: assets.updatedAt,
      user: { fullName: users.fullName },
    })
    .from(assets)
    .leftJoin(users, eq(assets.userId, users.id))
    .where(eq(assets.householdId, householdId));

  const documents = await fetchHouseholdDocumentsAction();
  // Fail soft (empty) until scripts/round49-family-plan.sql has been run.
  const [reminders, contacts, events, scenarios] = await Promise.all([
    listRemindersAction(),
    listContactsAction(),
    listEventsAction(),
    listScenariosAction(),
  ]);

  // Fetch live rates on the server so the first HTML byte is 100% accurate, eliminating the refresh flash.
  const initialLiveRates = await fetchLiveExchangeRatesAction();

  return (
    <DashboardClient 
      session={updatedSession} 
      initialAssets={rawAssets} 
      baseCurrency={baseCurrency} 
      initialDocuments={documents}
      initialLiveRates={initialLiveRates}
      showSetup={showSetup}
      reminders={reminders}
      contacts={contacts}
      events={events}
      scenarios={scenarios}
    />
  );
}