'use client';

import React, { useState } from 'react';
import { registerOwnerAction, registerMemberWithCodeAction, loginAction } from '@/actions/auth';
import { useRouter } from 'next/navigation';
import { Cpu, Users, Lock, Mail, Building, Key, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

type AuthResponse = {
  success: boolean;
  error?: string;
  role?: string;
};

export default function LoginPage() {
  const [tab, setTab] = useState<'signin' | 'register' | 'invite'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [capsLockOn, setCapsLockOn] = useState(false);
  const router = useRouter();

  const changeTab = (newTab: 'signin' | 'register' | 'invite') => {
    setTab(newTab);
    setError('');
    setLoading(false);
    setShowPassword(false);
    setPassword('');
    setCapsLockOn(false);
  };

  const getPasswordStrength = (pass: string) => {
    if (!pass) {
      return { score: 0, label: '', barColor: '', textColor: '' };
    }

    let score = 0;

    if (pass.length >= 8) score++;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score === 1) {
      return { score, label: 'Weak', barColor: 'bg-rose-500', textColor: 'text-rose-400' };
    }
    if (score === 2) {
      return { score, label: 'Fair', barColor: 'bg-amber-500', textColor: 'text-amber-400' };
    }
    if (score === 3) {
      return { score, label: 'Good', barColor: 'bg-teal-500', textColor: 'text-teal-400' };
    }
    return { score, label: 'Strong', barColor: 'bg-emerald-500', textColor: 'text-emerald-400' };
  };

  const strength = getPasswordStrength(password);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const formData = new FormData(e.currentTarget);
      let res: AuthResponse;

      if (tab === 'signin') {
        res = await loginAction(formData);
      } else if (tab === 'register') {
        res = await registerOwnerAction(formData);
      } else {
        res = await registerMemberWithCodeAction(formData);
      }

      if (res?.success) {
        router.push(res.role === 'SUPER_ADMIN' ? '/admin' : '/');
        return;
      }

      setError(res?.error || 'Authentication failed');
      if (tab !== 'signin') {
        setPassword('');
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError('Something went wrong. Please check your connection and try again.');
      if (tab !== 'signin') {
        setPassword('');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans selection:bg-teal-600 selection:text-white">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-teal-700 rounded-xl shadow-lg shadow-teal-900/40">
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
            disabled={loading}
            onClick={() => changeTab('signin')}
            className={`py-1.5 font-semibold rounded transition-colors cursor-pointer disabled:opacity-50 ${
              tab === 'signin' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => changeTab('register')}
            className={`py-1.5 font-semibold rounded transition-colors cursor-pointer disabled:opacity-50 ${
              tab === 'register' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            New Household
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => changeTab('invite')}
            className={`py-1.5 font-semibold rounded transition-colors cursor-pointer disabled:opacity-50 ${
              tab === 'invite' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Join Code
          </button>
        </div>

        {error ? (
          <div
            role="alert"
            aria-live="polite"
            className="text-xs text-rose-400 bg-rose-950/50 border border-rose-800 p-2.5 rounded-lg mb-4"
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'register' && (
            <>
              <div>
                <label htmlFor="householdName" className="block text-xs font-medium text-slate-400 mb-1">
                  Family / Household Name
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    id="householdName"
                    name="householdName"
                    required
                    disabled={loading}
                    autoComplete="organization"
                    onChange={() => { if (error) setError(''); }}
                    placeholder="e.g. Smith Family Vault"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="baseCurrency" className="block text-xs font-medium text-slate-400 mb-1">
                  Household Base Currency
                </label>
                <select
                  id="baseCurrency"
                  name="baseCurrency"
                  disabled={loading}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
              <label htmlFor="inviteCode" className="block text-xs font-medium text-slate-400 mb-1">
                Household Invite Code
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  id="inviteCode"
                  name="inviteCode"
                  required
                  disabled={loading}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="e.g. FAM-X92B4A"
                  onChange={(e) => {
                    e.currentTarget.value = e.target.value.toUpperCase();
                    if (error) setError('');
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 font-mono tracking-wider focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 uppercase disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          )}

          {(tab === 'register' || tab === 'invite') && (
            <div>
              <label htmlFor="fullName" className="block text-xs font-medium text-slate-400 mb-1">
                Your Full Name
              </label>
              <div className="relative">
                <Users className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  id="fullName"
                  name="fullName"
                  required
                  disabled={loading}
                  autoComplete="name"
                  onChange={() => { if (error) setError(''); }}
                  placeholder="e.g. Alex Smith"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-slate-400 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                id="email"
                name="email"
                type="email"
                required
                disabled={loading}
                autoComplete="email"
                inputMode="email"
                onChange={() => { if (error) setError(''); }}
                placeholder="user@family.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="password" className="block text-xs font-medium text-slate-400">
                Password
              </label>
              {capsLockOn && (
                <span className="text-[10px] text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Caps Lock is on
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                disabled={loading}
                minLength={tab === 'register' ? 8 : undefined}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                onFocus={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                onKeyDown={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                onBlur={() => setCapsLockOn(false)}
                autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                aria-describedby={tab === 'register' ? 'password-strength' : undefined}
                placeholder="Enter your password"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-11 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30 rounded-md transition-colors cursor-pointer disabled:opacity-50"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password strength bar shown during registration */}
            {tab === 'register' && password.length > 0 && (
              <div id="password-strength" className="mt-2 space-y-1">
                <div
                  className="flex gap-1 h-1 w-full bg-slate-950 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={4}
                  aria-valuenow={strength.score}
                  aria-label={`Password strength: ${strength.label}`}
                >
                  <div className={`h-full transition-all duration-300 ${strength.score >= 1 ? strength.barColor : 'bg-transparent'} w-1/4`} />
                  <div className={`h-full transition-all duration-300 ${strength.score >= 2 ? strength.barColor : 'bg-transparent'} w-1/4`} />
                  <div className={`h-full transition-all duration-300 ${strength.score >= 3 ? strength.barColor : 'bg-transparent'} w-1/4`} />
                  <div className={`h-full transition-all duration-300 ${strength.score >= 4 ? strength.barColor : 'bg-transparent'} w-1/4`} />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span>Strength: <strong className={strength.textColor}>{strength.label}</strong></span>
                  <span>8+ chars · upper & lower · number · symbol</span>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-teal-700 hover:bg-teal-600 text-white font-semibold text-sm rounded-lg cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-lg shadow-teal-900/30 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading
              ? 'Please wait...'
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