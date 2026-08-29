'use client';

import { useState, useTransition } from 'react';
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
  UserPlus, AlertCircle, Trash2, ArrowLeft, Coins, LogOut 
} from 'lucide-react';
import Footer from '@/components/Footer';

interface ProfileClientProps {
  session: {
    user: {
      id: string;
      fullName: string;
      email: string;
      role: string;
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
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200/85 dark:border-slate-800 px-4 md:px-8 py-3.5 shadow-sm transition-colors">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2.5 group cursor-pointer min-w-0">
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-white text-sm md:text-base tracking-tight truncate">
                    {householdDetails?.name || session?.household?.name || 'Private Family'}
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-teal-700 dark:text-teal-400 font-semibold font-mono">
                    Command Center
                  </div>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl transition border border-slate-200 dark:border-slate-700 shadow-sm">
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Dashboard</span>
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
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">View account details, customize legacy pillars, and manage members.</p>
            </div>

            <div className="flex items-center gap-2.5">
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
                          <input 
                            name={`pillar_desc_${idx}`} 
                            defaultValue={item.description} 
                            placeholder="e.g. Disbursed upon reaching age 35 for education and housing" 
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-teal-600 shadow-sm" 
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

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <Lock className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Security &amp; Password Change</h2>
            </div>

            {pwdError && <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-xl shadow-sm">{pwdError}</div>}
            {pwdSuccess && <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs p-3 rounded-xl flex items-center gap-2 shadow-sm"><CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> {pwdSuccess}</div>}

            <form onSubmit={handlePasswordChange} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1">Current Password</label>
                  <input name="currentPassword" type="password" required placeholder="••••••••" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white shadow-sm focus:outline-none focus:border-teal-600" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1">New Password</label>
                  <input name="newPassword" type="password" required placeholder="••••••••" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white shadow-sm focus:outline-none focus:border-teal-600" />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={pwdLoading} className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl cursor-pointer disabled:opacity-50 shadow-sm transition">
                  {pwdLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

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

          {isOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-teal-700 dark:text-teal-400" /> Add Family Member
                  </h3>
                  <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {error && (
                  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-xl flex items-center gap-2 shadow-sm">
                    <AlertCircle className="w-4 h-4" /> {error}
                  </div>
                )}

                <form onSubmit={handleAddMember} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">Full Name</label>
                    <input
                      name="fullName"
                      required
                      placeholder="e.g. Jane Doe"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-600 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">Email Address (For Invitation &amp; Login)</label>
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="jane@family.com"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-600 font-mono shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-medium">Role</label>
                    <select
                      name="role"
                      defaultValue="MEMBER"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 cursor-pointer font-medium shadow-sm"
                    >
                      <option value="MEMBER" className="bg-white dark:bg-slate-900">Member</option>
                      <option value="OWNER" className="bg-white dark:bg-slate-900">Owner / Admin</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold cursor-pointer transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-semibold cursor-pointer shadow-sm disabled:opacity-50 transition"
                    >
                      {loading ? 'Sending Invite...' : 'Add & Send Invite'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
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