import { db } from '@/db';
import { households, users } from '@/db/schema';
import { getSessionUserAction } from '@/actions/auth';
import { eq } from 'drizzle-orm';
import ProfileClient from '@/components/ProfileClient';
import AiSettingsCard from '@/components/AiSettingsCard';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, RefreshCw, LogOut, ArrowLeft, Coins } from 'lucide-react';
import { updateHouseholdBaseCurrencyAction, refreshLiveMarketPricesAction } from '@/actions/vault';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {
  const session = await getSessionUserAction();
  if (!session) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-sm font-sans">
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

  const baseCurrency = householdDetails?.baseCurrency || 'USD';

  const rawHouseholdName = householdDetails?.name 
    ? householdDetails.name.replace(/(\s+Vault|\s+Command|\s+Command Center)$/i, '') 
    : 'Private';
  const householdTitle = `${rawHouseholdName} Family`;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-20 flex flex-col justify-between selection:bg-teal-600 selection:text-white font-sans">
      <div>
        {/* CONSISTENT TOP HEADER */}
        <header className="bg-white border-b border-slate-200/85 sticky top-0 z-40 px-4 md:px-8 py-3.5 shadow-sm">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center justify-between w-full md:w-auto gap-4">
              <Link href="/" className="flex items-center gap-2.5 group cursor-pointer min-w-0">
                <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-slate-100 flex items-center justify-center shadow-sm">
                  <Image src="/omniwealth.jpg" alt="OmniWealth" width={32} height={32} className="object-cover w-full h-full" priority />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 text-sm md:text-base tracking-tight truncate">
                    {householdTitle}
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-teal-700 font-semibold font-mono">
                    Command Center
                  </div>
                </div>
              </Link>

              <nav className="hidden md:flex items-center gap-1.5 border-l border-slate-200 pl-4">
                <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5 text-teal-700" /> Back to Dashboard
                </Link>
              </nav>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-2.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none border-t md:border-t-0 border-slate-200 pt-2 md:pt-0">
              <div className="flex items-center gap-2.5 shrink-0">
                
                {/* Server action form for currency switcher */}
                <form 
                  action={async (formData) => {
                    'use server';
                    const curr = formData.get('currency') as string;
                    if (curr) {
                      await updateHouseholdBaseCurrencyAction(curr);
                    }
                  }}
                  className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl shrink-0 shadow-sm"
                >
                  <Coins className="w-4 h-4 text-slate-500" />
                  <select 
                    name="currency"
                    defaultValue={baseCurrency}
                    className="bg-transparent border-0 text-xs text-slate-800 font-mono font-bold focus:outline-none cursor-pointer"
                  >
                    {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'CHF', 'CNY'].map((c) => (
                      <option key={c} value={c} className="bg-white text-slate-900">{c}</option>
                    ))}
                  </select>
                  <button 
                    type="submit" 
                    className="px-2.5 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-[10px] font-semibold transition-colors cursor-pointer shadow-sm"
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
                    title="Sync Prices"
                    className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-sm shrink-0"
                  >
                    <RefreshCw className="w-4 h-4 text-slate-500" />
                    <span className="hidden sm:inline">Sync Prices</span>
                  </button>
                </form>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <form action={async () => { 
                  'use server';
                  redirect('/login'); 
                }} className="hidden md:block shrink-0">
                  <button type="submit" className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl transition-colors cursor-pointer text-xs font-semibold shadow-sm" title="Log Out">
                    <LogOut className="w-4 h-4" /> <span>Logout</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
          
          {/* 1. Core Profile & Family Management */}
          <ProfileClient 
            session={session} 
            initialFamilyMembers={familyMembers} 
            householdDetails={householdDetails} 
          />

          <div className="border-t border-slate-200 pt-6 space-y-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Advanced &amp; System Integrations</h3>

            {/* 2. Multi-AI Settings Card (BYOK) */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Multi-AI Provider Settings (BYOK)</h4>
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
      <footer className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-20 pt-8 border-t border-slate-200 text-slate-500 text-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div>&copy; 2026 OmniWealth Private Office. All rights reserved.</div>
        <div className="flex items-center gap-4 text-slate-700 font-medium">
          <Link href="/" className="hover:text-slate-900 transition-colors">Dashboard</Link>
          <span>•</span>
          <Link href="/vault" className="hover:text-slate-900 transition-colors">Vault</Link>
        </div>
      </footer>
    </main>
  );
}