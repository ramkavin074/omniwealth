import { fetchHouseholdDocumentsAction, getSessionUserAction, fetchFamilyMembersAction } from '@/actions/vault';
import DocumentVaultSection from '@/components/DocumentVaultSection';
import Footer from '@/components/Footer';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Shield, Lock, FileText, Settings, LogOut, Wallet } from 'lucide-react';
import { logoutAction } from '@/actions/vault';

export default async function VaultPageRoute() {
  const session = await getSessionUserAction();
  if (!session) {
    redirect('/');
  }

  const documents = await fetchHouseholdDocumentsAction();
  const householdTitle = session?.household?.name || 'Private Family';

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-20 flex flex-col justify-between selection:bg-teal-600 selection:text-white font-sans">
      <div>
        {/* Unified Header matching Dashboard & Profile */}
        <header className="bg-white border-b border-slate-200/85 sticky top-0 z-40 px-4 md:px-8 py-3.5 shadow-sm">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2.5 group cursor-pointer min-w-0">
                <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-slate-100 flex items-center justify-center shadow-sm">
                  <Image src="/omniwealth.jpg" alt="OmniWealth" width={32} height={32} className="object-cover w-full h-full" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 text-sm md:text-base tracking-tight truncate">
                    {householdTitle} Vault
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-teal-700 font-semibold font-mono">
                    Secure Storage
                  </div>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Link href="/" className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer shadow-sm">
                ← Back to Dashboard
              </Link>
              <Link href="/profile" title="Household Settings" className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition cursor-pointer shadow-sm">
                <Settings className="w-4 h-4" />
              </Link>
              <form action={logoutAction}>
                <button type="submit" title="Logout" className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl border border-rose-200 transition cursor-pointer shadow-sm">
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* Main Vault Content */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-xl text-teal-700">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  Secure Document Vault
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  AES-256-GCM encrypted family office storage for statements, deeds, and tax records.
                </p>
              </div>
            </div>
          </div>

          <DocumentVaultSection initialDocuments={documents} />
        </div>
      </div>

      <Footer />
    </main>
  );
}