'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { logoutAction } from '@/actions/auth';
import { updateHouseholdBaseCurrencyAction, updateThemePreferenceAction } from '@/actions/vault';
import { ArrowLeft, Coins, LogOut, Moon, Sun, Shield, Lock, Plus } from 'lucide-react';
import Footer from '@/components/Footer';
import AiSettingsCard from '@/components/AiSettingsCard';

import AccountDetailsCard from '@/components/profile/AccountDetailsCard';
import LegacyPillarsCard from '@/components/profile/LegacyPillarsCard';
import FamilyMembersCard from '@/components/profile/FamilyMembersCard';
import SecurityCard from '@/components/profile/SecurityCard';
import AddFamilyMemberModal from '@/components/profile/AddFamilyMemberModal';

interface ProfileClientProps {
  session: {
    user: {
      id: string;
      fullName: string;
      email: string;
      role: string;
      themePreference?: string;
      aiProvider?: string;
      aiApiKey?: string;
      geminiApiKey?: string;
      openaiApiKey?: string;
      anthropicApiKey?: string;
      groqApiKey?: string;
      openrouterApiKey?: string;
      [key: string]: any;
    };
    household: {
      id: string;
      name: string;
      baseCurrency: string;
      [key: string]: any;
    };
  };
  initialFamilyMembers: any[];
  householdDetails: any;
}

export default function ProfileClient({ session, initialFamilyMembers, householdDetails }: ProfileClientProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [success, setSuccess] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);
  }, []);

  const toggleTheme = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    const themeString = newMode ? 'dark' : 'light';

    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }

    try {
      await updateThemePreferenceAction(themeString as 'light' | 'dark');
    } catch (err) {
      console.error('Failed to sync theme preference to database:', err);
    }
  };

  const householdTitle = householdDetails?.name || session?.household?.name || 'Private Family';

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 flex flex-col justify-between selection:bg-teal-600 selection:text-white font-sans transition-colors">
      <div className="space-y-6">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200/85 dark:border-slate-800 px-3 md:px-8 py-3.5 shadow-sm transition-colors">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Link href="/" className="flex items-center gap-2.5 group cursor-pointer min-w-0">
                <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-sm">
                  <Image src="/omniwealth.jpg" alt="OmniWealth" width={36} height={36} className="object-cover w-full h-full" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-white text-[11px] sm:text-xs md:text-base tracking-tight truncate">
                    Family Wealth Hub
                  </div>
                  <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-teal-700 dark:text-teal-400 font-semibold font-mono truncate">
                    {householdTitle}
                  </div>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <CurrencySwitcherForm currentCurrency={session.household.baseCurrency} />

              <button
                onClick={toggleTheme}
                title="Toggle Theme"
                className="hidden sm:flex p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition cursor-pointer border border-slate-200 dark:border-slate-700 shadow-sm items-center justify-center"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
              </button>

              {session?.user?.role === 'SUPER_ADMIN' && (
                <Link
                  href="/admin"
                  title="Super Admin Portal"
                  className="p-2 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-xl border border-purple-200 dark:border-purple-900 transition cursor-pointer shadow-sm flex items-center justify-center"
                >
                  <Shield className="w-4 h-4" />
                </Link>
              )}

              <Link 
                href="/" 
                title="Back to Dashboard"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 px-2.5 sm:px-3 py-2 rounded-xl transition border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Back to Dashboard</span>
              </Link>

              <form action={logoutAction}>
                <button type="submit" title="Logout" className="p-2 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-900 transition cursor-pointer shadow-sm flex items-center justify-center">
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto w-full px-4 md:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Profile &amp; Family Management</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">View account details, customize legacy pillars, configure BYOK, and manage members.</p>
            </div>

            <div className="flex items-center gap-2.5">
              <Link 
                href="/vault" 
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition-colors shadow-sm"
              >
                <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400" /> Document Vault
              </Link>
              <button 
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Family Member
              </button>
            </div>
          </div>

          {success && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs p-3 rounded-xl flex items-center gap-2 shadow-sm">
              {success}
            </div>
          )}

          {/* 1. Account Details Card */}
          <AccountDetailsCard session={session} />

          {/* 2. Legacy & Wealth Pillars Card */}
          <LegacyPillarsCard householdDetails={householdDetails} />

          {/* 3. Family Members Card */}
          <FamilyMembersCard 
            initialFamilyMembers={initialFamilyMembers} 
            currentUserId={session.user.id} 
            onOpenAddModal={() => setIsOpen(true)} 
          />

          {/* 4. Multi-AI Free-First Cascade BYOK Settings Card */}
          <AiSettingsCard 
            initialGroq={Boolean(session.user.groqApiKey)}
            initialOpenrouter={Boolean(session.user.openrouterApiKey)}
            initialGemini={Boolean(session.user.geminiApiKey || session.user.aiApiKey)}
            initialOpenai={Boolean(session.user.openaiApiKey)}
            initialAnthropic={Boolean(session.user.anthropicApiKey)}
          />

          {/* 5. Security Card */}
          <SecurityCard />

          {/* Add Family Member Modal */}
          <AddFamilyMemberModal 
            isOpen={isOpen} 
            onClose={() => setIsOpen(false)} 
            onSuccess={(msg) => setSuccess(msg)} 
          />
        </div>
      </div>

      <Footer />
    </main>
  );
}

function CurrencySwitcherForm({ currentCurrency }: { currentCurrency: string }) {
  const router = useRouter();
  const [selectedCurrency, setSelectedCurrency] = useState(currentCurrency);
  const [isPending, startTransition] = useTransition();

  const handleCurrencyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCurrency = e.target.value;
    setSelectedCurrency(newCurrency);
    startTransition(async () => {
      await updateHouseholdBaseCurrencyAction(newCurrency);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl shrink-0 shadow-sm">
      <Coins className="w-4 h-4 text-slate-500 dark:text-slate-400" />
      <select 
        value={selectedCurrency} 
        onChange={handleCurrencyChange} 
        disabled={isPending}
        className="bg-transparent border-0 text-xs text-slate-800 dark:text-slate-200 font-mono font-bold focus:outline-none cursor-pointer disabled:opacity-50"
      >
        {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'CHF', 'CNY'].map((c) => (
          <option key={c} value={c} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{c}</option>
        ))}
      </select>
    </div>
  );
}