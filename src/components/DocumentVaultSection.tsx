'use client';

import { Lock, FileText } from 'lucide-react';

interface VaultDocument {
  id: string;
  householdId: string;
  userId: string;
  assetId: string | null;
  name: string;
  fileUrl: string;
  fileType: string;
  fileSize: string | null;
  createdAt: Date;
}

export default function DocumentVaultSection({ initialDocuments = [] }: { initialDocuments: VaultDocument[] }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <Lock className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">
          Encrypted Family Vault &amp; Documents
        </h3>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Securely stored legal wills, trust deeds, property deeds, and financial statements protected with AES-256 encryption.
      </p>

      {initialDocuments.length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-2">
          <div className="text-slate-700 dark:text-slate-300 font-bold text-sm">
            No documents uploaded to vault yet
          </div>
          <p className="text-xs text-slate-500">
            Upload statements or legal documents via the AI Reader or household settings.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {initialDocuments.map((doc) => (
            <div
              key={doc.id}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-500 dark:text-indigo-400 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-white text-xs truncate">{doc.name}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    {doc.fileType || 'PDF'} {doc.fileSize ? `• ${doc.fileSize}` : ''} • {new Date(doc.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-white rounded-lg text-xs font-semibold shrink-0 transition-colors border border-slate-200 dark:border-slate-700"
              >
                View
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
