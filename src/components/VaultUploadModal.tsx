'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadDocumentAction } from '@/actions/vault';
import { ShieldCheck, X, AlertCircle } from 'lucide-react';

interface VaultUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VaultUploadModal({ isOpen, onClose }: VaultUploadModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const res = await uploadDocumentAction(formData);

    setLoading(false);
    if (res.success) {
      onClose();
      router.refresh();
    } else {
      setError(res.error || 'Failed to encrypt and upload document.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 text-slate-900 dark:text-white my-auto">
        <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" /> 
            <span>Secure AES-256 Vault Upload</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-xl flex items-center gap-2 shadow-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> 
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="block text-slate-600 dark:text-slate-400 font-medium">Document Name</label>
            <input
              name="name"
              required
              placeholder="e.g. Living Trust Deed 2026"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-600 shadow-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-slate-600 dark:text-slate-400 font-medium">Select File (PDF, Image, Doc)</label>
            <input
              name="file"
              type="file"
              required
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-300 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 dark:file:bg-teal-950 dark:file:text-teal-300 hover:file:bg-teal-100 cursor-pointer shadow-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold cursor-pointer transition shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-semibold cursor-pointer shadow-sm disabled:opacity-50 transition"
            >
              {loading ? 'Encrypting File...' : 'Upload to Vault'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}