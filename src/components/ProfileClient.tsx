'use client';

import { useState } from 'react';
import { addFamilyMemberAction, deleteFamilyMemberAction, updatePasswordAction } from '@/actions/auth';
import { updateHouseholdLegacyPillarsAction } from '@/actions/vault';
import { Users, Key, ArrowLeft, User, Plus, X, CheckCircle2, Lock, Target, UserPlus, AlertCircle, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function ProfileClient({ session, initialFamilyMembers, householdDetails }: { session: any; initialFamilyMembers: any[]; householdDetails: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  const [pillarSuccess, setPillarSuccess] = useState('');

  // Parse legacy pillars JSON array
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
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 pb-16">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Profile &amp; Family Management</h1>
              <p className="text-xs text-slate-400">View account details, customize legacy pillars, and manage members.</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" /> Add Family Member
          </button>
        </div>

        {success && (
          <div className="bg-emerald-950/50 border border-emerald-800 text-emerald-400 text-xs p-3 rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {success}
          </div>
        )}

        {/* Account Details Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <User className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">My Account Details</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-slate-500 uppercase text-[10px] block">Full Name</span>
              <div className="font-bold text-white text-sm">{session.user.fullName}</div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-slate-500 uppercase text-[10px] block">Email Address</span>
              <div className="font-mono text-slate-300 text-sm">{session.user.email}</div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-slate-500 uppercase text-[10px] block">Role</span>
              <div className="font-mono text-indigo-300 font-bold uppercase">{session.user.role}</div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-slate-500 uppercase text-[10px] block">Household Base Currency</span>
              <div className="font-mono text-emerald-400 font-bold">{session.household.baseCurrency}</div>
            </div>
          </div>
        </div>

        {/* Customizable Legacy Pillars Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Target className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Customizable Legacy &amp; Wealth Pillars</h2>
          </div>
          <p className="text-xs text-slate-400">Define up to 4 core pillars with dedicated names and estate directives.</p>

          {pillarSuccess && (
            <div className="bg-emerald-950/50 border border-emerald-800 text-emerald-400 text-xs p-3 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> {pillarSuccess}
            </div>
          )}

          <form onSubmit={handlePillarUpdate} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((idx) => {
                const item = currentPillars[idx] || { name: '', description: '' };
                return (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Pillar {idx + 1}</div>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[10px] uppercase text-slate-400 mb-1">Pillar Name</label>
                        <input 
                          name={`pillar_name_${idx}`} 
                          defaultValue={item.name} 
                          placeholder="e.g. Krithik Legacy" 
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-indigo-500" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase text-slate-400 mb-1">Description / Directive</label>
                        <input 
                          name={`pillar_desc_${idx}`} 
                          defaultValue={item.description} 
                          placeholder="e.g. Krithik will get it when he turns 35" 
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-indigo-500" 
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl cursor-pointer transition-colors shadow-md">
                Save Pillars
              </button>
            </div>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Lock className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Security &amp; Password Change</h2>
          </div>

          {pwdError && <div className="bg-rose-950/50 border border-rose-800 text-rose-400 text-xs p-3 rounded-xl">{pwdError}</div>}
          {pwdSuccess && <div className="bg-emerald-950/50 border border-emerald-800 text-emerald-400 text-xs p-3 rounded-xl flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {pwdSuccess}</div>}

          <form onSubmit={handlePasswordChange} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Current Password</label>
                <input name="currentPassword" type="password" required placeholder="••••••••" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white" />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">New Password</label>
                <input name="newPassword" type="password" required placeholder="••••••••" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white" />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={pwdLoading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl cursor-pointer disabled:opacity-50">
                {pwdLoading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>

        {/* Registered Members List with Deletion Provision */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Users className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Registered Family Members ({initialFamilyMembers.length})</h2>
          </div>
          <div className="space-y-3">
            {initialFamilyMembers.map((member) => (
              <div key={member.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex justify-between items-center text-xs">
                <div>
                  <div className="font-bold text-white text-sm">{member.fullName}</div>
                  <div className="text-slate-400">{member.email}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                    {member.role}
                  </span>
                  {member.id !== session.user.id && (
                    <button
                      onClick={() => handleDeleteMember(member.id)}
                      className="p-1.5 bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 rounded-lg cursor-pointer transition-colors"
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

        {/* Add Family Member Modal Popup */}
        {isOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-400" /> Add Family Member
                </h3>
                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="bg-rose-950/50 border border-rose-800 text-rose-300 text-xs p-3 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}

              <form onSubmit={handleAddMember} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Full Name</label>
                  <input
                    name="fullName"
                    required
                    placeholder="e.g. Jane Doe"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Email Address (For Invitation &amp; Login)</label>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="jane@family.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Role</label>
                  <select
                    name="role"
                    defaultValue="MEMBER"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="OWNER">Owner / Admin</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {loading ? 'Sending Invite...' : 'Add & Send Invite'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}