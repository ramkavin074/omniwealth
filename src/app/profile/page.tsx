import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users, households, assets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionUserAction, fetchLiveExchangeRatesAction } from '@/actions/vault';
import ProfileClient from '@/components/ProfileClient';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await getSessionUserAction();
  if (!session) {
    redirect('/login');
  }

  const householdId = session.household.id;
  
  // Fetch family members using Drizzle
  const initialFamilyMembers = await db
    .select()
    .from(users)
    .where(eq(users.householdId, householdId));

  // Fetch household details using Drizzle
  const [householdDetails] = await db
    .select()
    .from(households)
    .where(eq(households.id, householdId));

  // Assets + FX so the pillars card can show progress toward each target.
  const householdAssets = await db
    .select()
    .from(assets)
    .where(eq(assets.householdId, householdId));
  const liveRates = await fetchLiveExchangeRatesAction();

  // Map session shape, converting database nulls to undefined to satisfy TypeScript
  const formattedSession = {
    user: {
      id: session.user.id,
      fullName: session.user.fullName,
      email: session.user.email,
      role: session.user.role,
      aiProvider: session.user.aiProvider || undefined,
      emailDigest: session.user.emailDigest ?? false,
      // Presence flags only — raw keys are never sent to the client.
      hasAiApiKey: session.user.hasAiApiKey,
      hasGeminiKey: session.user.hasGeminiKey,
      hasOpenaiKey: session.user.hasOpenaiKey,
      hasAnthropicKey: session.user.hasAnthropicKey,
      hasGroqKey: session.user.hasGroqKey,
      hasCerebrasKey: session.user.hasCerebrasKey,
      hasOpenrouterKey: session.user.hasOpenrouterKey,
    },
    household: {
      id: session.household.id,
      name: session.household.name,
      baseCurrency: session.household.baseCurrency,
    }
  };

  return (
    <ProfileClient
      session={formattedSession}
      initialFamilyMembers={initialFamilyMembers}
      householdDetails={householdDetails}
      assets={householdAssets}
      liveRates={liveRates}
    />
  );
}