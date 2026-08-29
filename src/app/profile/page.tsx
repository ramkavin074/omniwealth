import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users, households } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionUserAction } from '@/actions/vault';
import ProfileClient from '@/components/ProfileClient';
import AiSettingsCard from '@/components/AiSettingsCard';

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

  // Map session shape, converting database nulls to undefined to satisfy TypeScript
  const formattedSession = {
    user: {
      id: session.user.id,
      fullName: session.user.fullName,
      email: session.user.email,
      role: session.user.role,
      aiProvider: session.user.aiProvider || undefined,
      aiApiKey: session.user.aiApiKey || undefined,
      geminiApiKey: session.user.geminiApiKey || undefined,
      openaiApiKey: session.user.openaiApiKey || undefined,
      anthropicApiKey: session.user.anthropicApiKey || undefined,
      groqApiKey: session.user.groqApiKey || undefined,
      openrouterApiKey: session.user.openrouterApiKey || undefined,
    },
    household: {
      id: session.household.id,
      name: session.household.name,
      baseCurrency: session.household.baseCurrency,
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <ProfileClient 
        session={formattedSession} 
        initialFamilyMembers={initialFamilyMembers} 
        householdDetails={householdDetails} 
      />

      {/* Multi-AI Free-First Cascade BYOK Settings Card */}
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <AiSettingsCard 
          initialGroq={Boolean(session.user.groqApiKey)}
          initialOpenrouter={Boolean(session.user.openrouterApiKey)}
          initialGemini={Boolean(session.user.geminiApiKey || session.user.aiApiKey)}
          initialOpenai={Boolean(session.user.openaiApiKey)}
          initialAnthropic={Boolean(session.user.anthropicApiKey)}
        />
      </div>
    </div>
  );
}