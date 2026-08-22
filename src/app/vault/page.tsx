import { fetchHouseholdDocumentsAction, getSessionUserAction } from '@/actions/vault';
import DocumentVaultSection from '@/components/DocumentVaultSection';
import { redirect } from 'next/navigation';

export default async function VaultPageRoute() {
  const session = await getSessionUserAction();
  if (!session) {
    redirect('/');
  }

  const documents = await fetchHouseholdDocumentsAction();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Secure Document Vault
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              AES-256-GCM encrypted family office storage for statements, deeds, and tax records.
            </p>
          </div>
          <a
            href="/"
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            ← Back to Dashboard
          </a>
        </div>

        <DocumentVaultSection initialDocuments={documents} />
      </div>
    </div>
  );
}