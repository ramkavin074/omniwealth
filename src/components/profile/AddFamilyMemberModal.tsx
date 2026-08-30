'use client';

import { useState } from 'react';
import { UserPlus, X, AlertCircle } from 'lucide-react';
import { addFamilyMemberAction } from '@/actions/vault';

interface AddFamilyMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function AddFamilyMemberModal({ isOpen, onClose, onSuccess }: AddFamilyMemberModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleAddMember(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await addFamilyMemberAction(formData);
      if (res?.success) {
        onSuccess('Invitation email sent. They will appear here once they accept and set a password.');
        form.reset();
        onClose();
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setError(res?.error || 'Failed to send invitation.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-teal-700 dark:text-teal-400" /> Add Family Member
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer">
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

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            They will receive an email invitation and join as a household
            <span className="font-semibold"> Member</span>. You can adjust their
            role afterwards.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
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
  );
}