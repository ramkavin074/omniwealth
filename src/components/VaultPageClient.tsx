'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Lock, Settings, LogOut, ArrowLeft } from 'lucide-react';
import SecureDocumentsVault from '@/components/dashboard/SecureDocumentsVault';
import VaultUploadModal from '@/components/VaultUploadModal';
import Footer from '@/components/Footer';
import { logoutAction } from '@/actions/vault';

export default function VaultPageClient({ initialDocuments, householdTitle }: { initialDocuments: any[]; householdTitle: string }) {
  const [isVaultUploadOpen, setIsVaultUploadOpen] = useState(false);
  const router = useRouter();

  const goBack = () => {
    // Return to wherever the user came from (profile or dashboard);
    // fall back to the dashboard on a fresh / deep-link entry.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 flex flex-col justify-between selection:bg-teal-600 selection:text-white font-sans transition-colors">
      <div>
        {/* Unified Header matching Dashboard & Profile */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200/85 dark:border-slate-800 sticky top-0 z-40 px-3 md:px-8 py-3.5 shadow-sm transition-colors">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Link href="/" className="flex items-center gap-2.5 group cursor-pointer min-w-0">
                <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-sm">
                  <Image src="/omniwealth.jpg" alt="OmniWealth" width={32} height={32} className="object-cover w-full h-full" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-white text-xs md:text-base tracking-tight truncate">
                    {householdTitle}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-teal-700 dark:text-teal-400 font-semibold font-mono">
                    Secure Storage
                  </div>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              <button
                type="button"
                onClick={goBack}
                title="Back"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 px-2.5 sm:px-3 py-2 rounded-xl transition border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <Link href="/profile" title="Household Settings" className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-sm">
                <Settings className="w-4 h-4" />
              </Link>
              <form action={logoutAction}>
                <button type="submit" title="Logout" className="p-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-900 transition cursor-pointer shadow-sm">
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* Main Vault Content */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-2 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl text-teal-700 dark:text-teal-400">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Secure Document Vault
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  AES-256-GCM encrypted family office storage for statements, deeds, and tax records.
                </p>
              </div>
            </div>
          </div>

          <SecureDocumentsVault documents={initialDocuments} onOpenUpload={() => setIsVaultUploadOpen(true)} />
        </div>
      </div>

      <Footer />

      {isVaultUploadOpen && (
        <VaultUploadModal isOpen={isVaultUploadOpen} onClose={() => setIsVaultUploadOpen(false)} />
      )}
    </main>
  );
}