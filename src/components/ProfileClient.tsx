'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { updatePasswordAction, logoutAction } from '@/actions/auth';
import { 
  addFamilyMemberAction, 
  deleteFamilyMemberAction, 
  updateHouseholdLegacyPillarsAction, 
  updateHouseholdBaseCurrencyAction 
} from '@/actions/vault';
import { 
  Users, User, Plus, X, CheckCircle2, Lock, Target, 
  UserPlus, AlertCircle, Trash2, ArrowLeft, Coins, LogOut, Moon, Sun 
} from 'lucide-react';
import Footer from '@/components/Footer';
import AiSettingsCard from '@/components/AiSettingsCard';

interface ProfileClientProps {
  session: {
    user: {
      id: string;
      fullName: string;
      email: string;
      role: string;
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  const [pillarSuccess, setPillarSuccess] = useState('');

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  let currentPillars: { name: string; description: string }[] = [];
  try {
    currentPillars = JSON.parse(householdDetails?.legacyPillars || '[]');
  } catch (e) {
    currentPillars = (householdDetails?.legacyPillars || '').split(',').map((p: string) => {
      const parts = p.split(' - ');
      return { name: parts[0]?.trim() || p, description: parts[1]?.trim() || '' };
    });
  }

  async function handleAddMember(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await addFamilyMemberAction(formData);
      if (res?.success) {
        setSuccess('Family member successfully added & invitation email sent!');
        form.reset();
        setIsOpen(false);
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setError(res?.error || 'Failed to add member.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteMember(memberId: string) {
    if (!confirm('Are you sure you want to remove this family member from the household?')) return;
    const res = await deleteFamilyMemberAction(memberId);
    if (res.success) {
      window.location.reload();
    } else {
      alert(res.error || 'Failed to remove member.');
    }
  }

  async function handlePasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwdLoading(true);
    setPwdError('');
    setPwdSuccess('');

    const formData = new FormData(e.currentTarget);
    const res = await updatePasswordAction(formData);
    setPwdLoading(false);

    if (!res.success) {
      setPwdError(res.error || 'Failed to update password.');
    } else {
      setPwdSuccess('Password successfully updated!');
      (e.target as HTMLFormElement).reset();
    }
  }

  async function handlePillarUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPillarSuccess('');
    const formData = new FormData(e.currentTarget);
    const res = await updateHouseholdLegacyPillarsAction(formData);
    if (res.success) {
      setPillarSuccess('Legacy pillars updated successfully!');
      setTimeout(() => window.location.reload(), 800);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 flex flex-col justify-between selection:bg-teal-600 selection:text-white font-sans transition-colors">
      <div className="space-y-6">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200/85 dark:border-slate-800 px-3 md:px-8 py-3.5 shadow-sm transition-colors">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Link href="/" className="flex items-center gap-2 group cursor-pointer min-w-0">
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-white text-xs md:text-base tracking-tight truncate">
                    {householdDetails?.name || session?.household?.name || 'Private Family'}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-teal-700 dark:text-teal-400 font-semibold font-mono">
                    Command Center
                  </div>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <button
                onClick={toggleTheme}
                title="Toggle Theme"
                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition cursor-pointer border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
              </button>

              <Link 
                href="/" 
                title="Back to Dashboard"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 px-2.5 sm:px-3 py-2 rounded-xl transition border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Back to Dashboard</span>
              </Link>

              <CurrencySwitcherForm currentCurrency={session.household.baseCurrency} />

              <form action={logoutAction}>
                <button type="submit" title="Logout" className="p-2 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-900 transition cursor-pointer shadow-sm">
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
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> {success}
            </div>
          )}

          {/* 1. Account Details */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <User className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">My Account Details</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1 shadow-sm">
                <span className="text-slate-500 dark:text-slate-400 uppercase text-[10px] block font-medium">Full Name</span>
                <div className="font-bold text-slate-900 dark:text-white text-sm">{session.user.fullName}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1 shadow-sm">
                <span className="text-slate-500 dark:text-slate-400 uppercase text-[10px] block font-medium">Email Address</span>
                <div className="font-mono text-slate-700 dark:text-slate-300 text-sm">{session.user.email}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1 shadow-sm">
                <span className="text-slate-500 dark:text-slate-400 uppercase text-[10px] block font-medium">Role</span>
                <div className="font-mono text-teal-700 dark:text-teal-400 font-bold uppercase">{session.user.role}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1 shadow-sm">
                <span className="text-slate-500 dark:text-slate-400 uppercase text-[10px] block font-medium">Household Base Currency</span>
                <div className="font-mono text-teal-700 dark:text-teal-400 font-bold">{session.household.baseCurrency}</div>
              </div>
            </div>
          </div>

          {/* 2. Legacy & Wealth Pillars */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <Target className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Customizable Legacy &amp; Wealth Pillars</h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">Define up to 4 core pillars with dedicated names and estate directives.</p>

            {pillarSuccess && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs p-3 rounded-xl flex items-center gap-2 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> {pillarSuccess}
              </div>
            )}

            <form onSubmit={handlePillarUpdate} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[0, 1, 2, 3].map((idx) => {
                  const item = currentPillars[idx] || { name: '', description: '' };
                  return (
                    <div key={idx} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-sm">
                      <div className="text-[10px] uppercase font-bold text-teal-700 dark:text-teal-400 tracking-wider">Pillar {idx + 1}</div>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 mb-1 font-medium">Pillar Name</label>
                          <input 
                            name={`pillar_name_${idx}`} 
                            defaultValue={item.name} 
                            placeholder="e.g. Next Generation Family Trust" 
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-teal-600 shadow-sm" 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 mb-1 font-medium">Description / Directive</label>
                          <textarea 
                            name={`pillar_desc_${idx}`} 
                            defaultValue={item.description} 
                            rows={3}
                            placeholder="e.g. Disbursed upon reaching age 35 for education and housing" 
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-teal-600 resize-none shadow-sm leading-relaxed" 
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end pt-2">
                <button type="submit" className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl cursor-pointer transition-colors shadow-sm">
                  Save Pillars
                </button>
              </div>
            </form>
          </div>
          {/* 3. Family Members */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <Users className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Registered Family Members ({initialFamilyMembers.length})</h2>
            </div>
            <div className="space-y-3">
              {initialFamilyMembers.map((member) => (
                <div key={member.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex justify-between items-center text-xs shadow-sm">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-sm">{member.fullName}</div>
                    <div className="text-slate-500 dark:text-slate-400">{member.email}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded font-bold border ${
                      member.role === 'SUPER_ADMIN' 
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900' 
                        : 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-900'
                    }`}>
                      {member.role}
                    </span>
                    {member.id !== session.user.id && (
                      <button
                        onClick={() => handleDeleteMember(member.id)}
                        className="p-1.5 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer transition-colors shadow-sm"
                        title="Remove Family Member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          'use client';

import { useState } from 'react';
import { Cpu, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { updateAiKeysAction } from '@/actions/vault'; // adjust import path as needed

interface AiSettingsCardProps {
  initialGroq: boolean;
  initialOpenrouter: boolean;
  initialGemini: boolean;
  initialOpenai: boolean;
  initialAnthropic: boolean;
}

export default function AiSettingsCard({
  initialGroq,
  initialOpenrouter,
  initialGemini,
  initialOpenai,
  initialAnthropic,
}: AiSettingsCardProps) {
  const [groq, setGroq] = useState('');
  const [openrouter, setOpenrouter] = useState('');
  const [gemini, setGemini] = useState('');
  const [openai, setOpenai] = useState('');
  const [anthropic, setAnthropic] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [hasGroq, setHasGroq] = useState(initialGroq);
  const [hasOpenrouter, setHasOpenrouter] = useState(initialOpenrouter);
  const [hasGemini, setHasGemini] = useState(initialGemini);
  const [hasOpenai, setHasOpenai] = useState(initialOpenai);
  const [hasAnthropic, setHasAnthropic] = useState(initialAnthropic);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await updateAiKeysAction({
        groqApiKey: groq || undefined,
        openrouterApiKey: openrouter || undefined,
        geminiApiKey: gemini || undefined,
        openaiApiKey: openai || undefined,
        anthropicApiKey: anthropic || undefined,
      });

      if (res.success) {
        setSuccess('AI API keys securely updated and encrypted!');
        if (groq) setHasGroq(true);
        if (openrouter) setHasOpenrouter(true);
        if (gemini) setHasGemini(true);
        if (openai) setHasOpenai(true);
        if (anthropic) setHasAnthropic(true);
        setGroq('');
        setOpenrouter('');
        setGemini('');
        setOpenai('');
        setAnthropic('');
      } else {
        setError(res.error || 'Failed to update API keys.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Multi-AI Free-First Cascade Settings (BYOK)
          </h2>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
          Encrypted Storage
        </span>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        Configure your API keys below. The vault automatically prioritizes free providers first (<strong className="text-slate-900 dark:text-white">Groq → OpenRouter → Gemini</strong>), cascading to paid backups only if needed.
      </p>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-xl flex items-center gap-2 shadow-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs p-3 rounded-xl flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" /> {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Groq */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300">
                1. Groq API Key (Free Tier - Ultra Fast Llama)
              </label>
              {hasGroq && (
                <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded-full">
                  Stored in DB
                </span>
              )}
            </div>
            <input
              type="password"
              value={groq}
              onChange={(e) => setGroq(e.target.value)}
              placeholder={hasGroq ? '•••••••••••••••• (Stored)' : 'gsk_...'}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono shadow-sm focus:outline-none focus:border-teal-600"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Get a free key at console.groq.com (No credit card required)
            </p>
          </div>

          {/* OpenRouter */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300">
                2. OpenRouter API Key (Free Models Router)
              </label>
              {hasOpenrouter && (
                <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded-full">
                  Stored in DB
                </span>
              )}
            </div>
            <input
              type="password"
              value={openrouter}
              onChange={(e) => setOpenrouter(e.target.value)}
              placeholder={hasOpenrouter ? '•••••••••••••••• (Stored)' : 'or-v1-...'}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono shadow-sm focus:outline-none focus:border-teal-600"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Get a free key at openrouter.ai (Access to rotating free models)
            </p>
          </div>

          {/* Gemini */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300">
                3. Gemini API Key (Google AI Studio)
              </label>
              {hasGemini && (
                <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded-full">
                  Stored in DB
                </span>
              )}
            </div>
            <input
              type="password"
              value={gemini}
              onChange={(e) => setGemini(e.target.value)}
              placeholder={hasGemini ? '•••••••••••••••• (Stored)' : 'AIza...'}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono shadow-sm focus:outline-none focus:border-teal-600"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Get a key at aistudio.google.com
            </p>
          </div>

          {/* OpenAI */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] uppercase font-bold text-slate-700 dark:text-slate-300">
                4. OpenAI API Key (Paid Backup)
              </label>
              {hasOpenai && (
                <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded-full">
                  Stored in DB
                </span>
              )}
            </div>
            <input
              type="password"
              value={openai}
              onChange={(e) => setOpenai(e.target.value)}
              placeholder={hasOpenai ? '•••••••••••••••• (Stored)' : 'sk-...'}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono shadow-sm focus:outline-none focus:border-teal-600"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Optional paid fallback for high-capacity tasks
            </p>
          </div>

        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl cursor-pointer disabled:opacity-50 shadow-sm transition"
          >
            {loading ? 'Saving Keys...' : 'Save AI Keys'}
          </button>
        </div>
      </form>
    </div>
  );
}

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
    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-1.5 rounded-xl shrink-0 shadow-sm">
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