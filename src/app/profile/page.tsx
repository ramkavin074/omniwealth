import { db } from '@/db';
import { households, users, documents } from '@/db/schema';
import { getSessionUserAction } from '@/actions/auth';
import { eq, count } from 'drizzle-orm';
import ProfileClient from '@/components/ProfileClient';
import AiSettingsCard from '@/components/AiSettingsCard';
import Link from 'next/link';
import Image from 'next/image';
import { Lock, Sparkles, RefreshCw, LogOut, ArrowLeft, Coins } from 'lucide-react';
import { updateHouseholdBaseCurrencyAction, refreshLiveMarketPricesAction } from '@/actions/vault';
import { redirect } from 'next/navigation';

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
  const baseCurrency = householdDetails?.baseCurrency || 'USD';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-20 flex flex-col justify-between">
      <div>
        {/* CONSISTENT TOP HEADER */}
        <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 px-4 md:px-8 py-3.5 shadow-lg">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center justify-between w-full md:w-auto gap-4">
              <Link href="/" className="flex items-center gap-3 group cursor-pointer">
                <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-indigo-500/30 shrink-0 bg-slate-800 group-hover:border-indigo-400 transition-colors">
                  <Image src="/omniwealth.jpg" alt="OmniWealth Studio" fill className="object-cover" priority />
                </div>
                <div>
                  <div className="font-bold text-white text-xs tracking-tight group-hover:text-indigo-300 transition-colors">
                    {householdDetails?.name?.replace(/ Vault$/i, '') || 'Household'} Vault
                  </div>
                  <div className="text-[10px] text-slate-400">Wealth Command Center</div>
                </div>
              </Link>

              <nav className="hidden md:flex items-center gap-1.5 border-l border-slate-800 pl-4">
                <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5 text-indigo-400" /> Back to Dashboard
                </Link>
              </nav>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-2.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none border-t md:border-t-0 border-slate-800 pt-2 md:pt-0">
              <div className="flex items-center gap-2 shrink-0">
                
                {/* Server action form for currency switcher */}
                <form 
                  action={async (formData) => {
                    'use server';
                    const curr = formData.get('currency') as string;
                    if (curr) {
                      await updateHouseholdBaseCurrencyAction(curr);
                    }
                  }}
                  className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl shrink-0 shadow-sm"
                >
                  <Coins className="w-3.5 h-3.5 text-indigo-400" />
                  <select 
                    name="currency"
                    defaultValue={baseCurrency}
                    className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-indigo-300 font-mono font-bold focus:outline-none cursor-pointer"
                  >
                    {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'CHF', 'CNY'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button 
                    type="submit" 
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                  >
                    Save
                  </button>
                </form>

                <form 
                  action={async () => {
                    'use server';
                    await refreshLiveMarketPricesAction();
                  }}
                >
                  <button 
                    type="submit"
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-sm shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Sync Prices</span>
                  </button>
                </form>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <form action={async () => { 
                  'use server';
                  redirect('/login'); 
                }} className="hidden md:block shrink-0">
                  <button type="submit" className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 border border-slate-700 rounded-xl transition-colors cursor-pointer text-xs font-semibold shadow-sm" title="Log Out">
                    <LogOut className="w-3.5 h-3.5" /> <span>Logout</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
          
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
      </div>

      {/* PROFESSIONAL FOOTER */}
      <footer className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-20 pt-8 border-t border-slate-800 text-slate-400 text-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div>&copy; 2026 OmniWealth. All rights reserved.</div>
        <div className="flex items-center gap-4 text-slate-300">
          <Link href="/" className="hover:text-indigo-400 transition-colors">Dashboard</Link>
          <span>•</span>
          <Link href="/vault" className="hover:text-indigo-400 transition-colors">Vault</Link>
        </div>
      </footer>
    </main>
  );
}