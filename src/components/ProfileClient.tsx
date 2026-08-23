import { db } from '@/db';
import { households, users, documents } from '@/db/schema';
import { getSessionUserAction } from '@/actions/auth';
import { eq, count } from 'drizzle-orm';
import ProfileClient from '@/components/ProfileClient';
import AiSettingsCard from '@/components/AiSettingsCard';
import Link from 'next/link';
import { Lock, Sparkles } from 'lucide-react';

export default async function ProfilePage() {
  const session = await getSessionUserAction();
  if (!session) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Please log in to access your profile.
      </main>
    );
  }

  // Fetch fresh user record from DB to verify saved API keys
  const [currentUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id));

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
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* 1. Core Profile & Family Management (Primary Focus) */}
        <ProfileClient 
          session={session} 
          initialFamilyMembers={familyMembers} 
          householdDetails={householdDetails} 
        />

        <div className="border-t border-slate-800 pt-6 space-y-6">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Advanced &amp; System Integrations</h3>

          {/* 2. Secure Document Vault Quick Access Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Secure Document Vault</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Household-wide AES-256 encrypted storage protecting <span className="text-indigo-400 font-semibold">{documentCount}</span> document{documentCount === 1 ? '' : 's'}.
                </p>
              </div>
            </div>
            <Link
              href="/vault"
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition border border-slate-700 flex items-center gap-2 whitespace-nowrap"
            >
              Open Vault →
            </Link>
          </div>

          {/* 3. Multi-AI Settings Card (BYOK) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Multi-AI Provider Settings (BYOK)</h4>
            </div>
            <AiSettingsCard 
              initialGroq={!!currentUser?.groqApiKey}
              initialOpenrouter={!!currentUser?.openrouterApiKey}
              initialGemini={!!currentUser?.geminiApiKey} 
              initialOpenai={!!currentUser?.openaiApiKey} 
              initialAnthropic={!!currentUser?.anthropicApiKey} 
            />
          </div>
        </div>

      </div>
    </main>
  );
}