'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { logoutAction } from '@/actions/auth';
import { updateHouseholdBaseCurrencyAction, updateThemePreferenceAction } from '@/actions/vault';
import { ArrowLeft, Coins, LogOut, Moon, Sun, Shield, Lock, Plus, Menu, X, Home, Settings2 } from 'lucide-react';
import Footer from '@/components/Footer';
import AiSettingsCard from '@/components/AiSettingsCard';
import { canManageHousehold } from '@/lib/permissions';

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
  assets?: any[];
  liveRates?: { [key: string]: number };
}

export default function ProfileClient({ session, initialFamilyMembers, householdDetails, assets = [], liveRates = {} }: ProfileClientProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
            {/* Left side: Sandwich Menu + Logo / Title */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition shrink-0 shadow-sm"
                aria-label="Open Navigation Menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <Link
                href="/"
                className="flex items-center gap-2 group cursor-pointer min-w-0 flex-1"
              >
                <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-sm">
                  <Image
                    src="/omniwealth.jpg"
                    alt="OmniWealth"
                    width={32}
                    height={32}
                    className="object-cover w-full h-full"
                  />
                </div>

                <div className="min-w-0 flex-1 leading-tight">
                  <div className="font-extrabold text-xs sm:text-sm md:text-base tracking-tight text-slate-900 dark:text-white truncate">
                    Family Wealth Hub
                  </div>

                  <div className="text-[10px] sm:text-xs uppercase tracking-wider text-teal-700 dark:text-teal-400 font-semibold font-mono truncate">
                    {householdTitle}
                  </div>
                </div>
              </Link>
            </div>

            {/* Right side controls (Currency & Theme visible on desktop, hidden on mobile to keep mobile header clean) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="hidden sm:block">
                <CurrencySwitcherForm currentCurrency={session.household.baseCurrency} />
              </div>

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
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl transition border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>Back to Dashboard</span>
              </Link>

              <form action={logoutAction}>
                <button type="submit" title="Logout" className="p-2 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-900 transition cursor-pointer shadow-sm flex items-center justify-center">
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer (Includes Theme Switcher & Currency Switcher) */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden print:hidden">
            <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="relative w-4/5 max-w-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white h-full shadow-2xl z-10 flex flex-col justify-between p-6 border-r border-slate-200 dark:border-slate-800 overflow-y-auto">
              <div className="space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-sm">
                      <Image src="/omniwealth.jpg" alt="OmniWealth" width={32} height={32} className="object-cover w-full h-full" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white text-xs tracking-tight truncate">
                        Family Wealth Hub
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-teal-700 dark:text-teal-400 font-semibold font-mono truncate">
                        {householdTitle}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer shrink-0">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="flex flex-col space-y-1.5 pt-2">
                  <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors">
                    <Home className="w-4 h-4" /><span>Dashboard</span>
                  </Link>
                  <Link href="/vault" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors">
                    <Lock className="w-4 h-4" /><span>Document Vault</span>
                  </Link>
                  <Link href="/profile" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors">
                    <Settings2 className="w-4 h-4" /><span>Profile &amp; Family</span>
                  </Link>

                  {/* Theme Switcher inside Mobile Drawer */}
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between py-3 px-3.5 rounded-xl text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center space-x-3.5">
                      {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
                      <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
                    </span>
                  </button>

                  {/* Currency Switcher inside Mobile Drawer */}
                  <div className="py-2 px-3.5 flex items-center justify-between rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <span className="flex items-center space-x-3.5 text-sm font-semibold">
                      <Coins className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <span>Base Currency</span>
                    </span>
                    <CurrencySwitcherForm currentCurrency={session.household.baseCurrency} />
                  </div>

                  {session?.user?.role === 'SUPER_ADMIN' && (
                    <Link href="/admin" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-sm font-semibold hover:bg-purple-50 dark:hover:bg-purple-950/40 text-purple-700 dark:text-purple-300 transition-colors">
                      <Shield className="w-4 h-4" /><span>Super Admin Portal</span>
                    </Link>
                  )}
                </nav>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <form action={logoutAction} className="pt-1">
                  <button type="submit" className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-sm font-semibold rounded-xl border border-rose-200 dark:border-rose-900 cursor-pointer transition">
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

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
              {canManageHousehold(session.user.role) && (
                <button
                  onClick={() => setIsOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Add Family Member
                </button>
              )}
            </div>
          </div>

          {success && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs p-3 rounded-xl flex items-center gap-2 shadow-sm">
              {success}
            </div>
          )}

          {/* 1. Account Details Card */}
          <AccountDetailsCard session={session} />

          {/* 2. Family Members Card */}
          <FamilyMembersCard
            initialFamilyMembers={initialFamilyMembers}
            currentUserId={session.user.id}
            currentUserRole={session.user.role}
            onOpenAddModal={() => setIsOpen(true)}
          />

          {/* 3. Legacy & Wealth Pillars Card */}
          <LegacyPillarsCard
            householdDetails={householdDetails}
            assets={assets}
            baseCurrency={householdDetails?.baseCurrency || session.household.baseCurrency || 'USD'}
            liveRates={liveRates}
          />

          {/* 4. Multi-AI Free-First Cascade BYOK Settings Card */}
          <AiSettingsCard
            configured={{
              groqApiKey: session.user.hasGroqKey,
              cerebrasApiKey: session.user.hasCerebrasKey,
              openrouterApiKey: session.user.hasOpenrouterKey,
              geminiApiKey: session.user.hasGeminiKey || session.user.hasAiApiKey,
              openaiApiKey: session.user.hasOpenaiKey,
              anthropicApiKey: session.user.hasAnthropicKey,
            }}
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