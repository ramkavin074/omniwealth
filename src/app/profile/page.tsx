import { db } from '@/db';
import { households, users, documents } from '@/db/schema';
import { getSessionUserAction } from '@/actions/auth';
import { eq, count } from 'drizzle-orm';
import ProfileClient from '@/components/ProfileClient';
import AiSettingsCard from '@/components/AiSettingsCard';
import Link from 'next/link';

export default async function ProfilePage() {
  const session = await getSessionUserAction();
  if (!session) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Please log in to access your profile.
      </main>
    );
  }

  const familyMembers = await db
    .select()
    .from(users)
    .where(eq(users.householdId, session.household.id));

  const [householdDetails] = await db
    .select()
    .from(households)
    .where(eq(households.id, session.household.id));

  const [docCountResult] = await db
    .select({ value: count() })
    .from(documents)
    .where(eq(documents.householdId, session.household.id));

  const documentCount = docCountResult?.value || 0;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Secure Document Vault Quick Access Card */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg text-lg">🔒</span>
              <h2 className="text-lg font-bold text-white">Secure Document Vault</h2>
            </div>
            <p className="text-sm text-slate-300 mt-1">
              Household-wide AES-256-GCM encrypted storage. Currently protecting <span className="text-indigo-400 font-semibold">{documentCount}</span> document{documentCount === 1 ? '' : 's'}.
            </p>
          </div>
          <Link
            href="/vault"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2 whitespace-nowrap"
          >
            Open Vault →
          </Link>
        </div>

        {/* Multi-AI Failover Settings Card */}
        <AiSettingsCard 
          initialGemini={!!session.user.geminiApiKey} 
          initialOpenai={!!session.user.openaiApiKey} 
          initialAnthropic={!!session.user.anthropicApiKey} 
        />

        {/* Profile & Family Members Manager */}
        <ProfileClient 
          session={session} 
          initialFamilyMembers={familyMembers} 
          householdDetails={householdDetails} 
        />
      </div>
    </main>
  );
}