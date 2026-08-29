'use client';

import { User } from 'lucide-react';

interface AccountDetailsCardProps {
  session: {
    user: {
      fullName: string;
      email: string;
      role: string;
    };
    household: {
      baseCurrency: string;
    };
  };
}

export default function AccountDetailsCard({ session }: AccountDetailsCardProps) {
  return (
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
  );
}