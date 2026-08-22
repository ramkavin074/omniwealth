'use client';

import React, { useState } from 'react';
import { registerOwnerAction, registerMemberWithCodeAction, loginAction } from '@/actions/auth';
import { useRouter } from 'next/navigation';
import { Cpu, Users, Lock, Mail, Building, Key } from 'lucide-react';

export default function LoginPage() {
  const [tab, setTab] = useState<'signin' | 'register' | 'invite'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.currentTarget);

    let res;
    if (tab === 'signin') {
      res = await loginAction(formData);
    } else if (tab === 'register') {
      res = await registerOwnerAction(formData);
    } else {
      res = await registerMemberWithCodeAction(formData);
    }

    if (res?.success) {
      if (res.role === 'SUPER_ADMIN') {
        router.push('/admin');
      } else {
        router.push('/');
      }
    } else {
      setError(res?.error || 'Authentication failed');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
            <Cpu className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">OmniWealth Engine</h1>
            <p className="text-xs text-slate-400">Multi-Currency Family Portal</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 bg-slate-950 p-1 rounded-lg mb-6 border border-slate-800 text-[11px]">
          <button
            type="button"
            onClick={() => { setTab('signin'); setError(''); }}
            className={`py-1.5 font-semibold rounded transition-colors cursor-pointer ${
              tab === 'signin' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(''); }}
            className={`py-1.5 font-semibold rounded transition-colors cursor-pointer ${
              tab === 'register' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            New Household
          </button>
          <button
            type="button"
            onClick={() => { setTab('invite'); setError(''); }}
            className={`py-1.5 font-semibold rounded transition-colors cursor-pointer ${
              tab === 'invite' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Join Code
          </button>
        </div>

        {error ? (
          <div className="text-xs text-rose-400 bg-rose-950/50 border border-rose-800 p-2.5 rounded-lg mb-4">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'register' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Family / Household Name
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    name="familyName"
                    required
                    placeholder="e.g. Kavin Family Vault"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Household Base Currency
                </label>
                <select
                  name="baseCurrency"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="CAD">CAD ($)</option>
                </select>
              </div>
            </>
          )}

          {tab === 'invite' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Household Invite Code
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  name="inviteCode"
                  required
                  placeholder="e.g. FAM-X92B4A"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 font-mono tracking-wider focus:outline-none focus:border-indigo-500 uppercase"
                />
              </div>
            </div>
          )}

          {(tab === 'register' || tab === 'invite') && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Your Full Name
              </label>
              <div className="relative">
                <Users className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  name="fullName"
                  required
                  placeholder="e.g. Kavin Kumar"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                name="email"
                type="email"
                required
                placeholder="user@family.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-lg cursor-pointer transition-colors disabled:opacity-50 mt-2 shadow-lg shadow-indigo-600/20"
          >
            {loading
              ? 'Authenticating...'
              : tab === 'signin'
              ? 'Sign In'
              : tab === 'register'
              ? 'Create Household'
              : 'Join Household'}
          </button>
        </form>
      </div>
    </div>
  );
}