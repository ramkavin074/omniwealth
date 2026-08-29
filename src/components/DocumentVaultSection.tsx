'use client';

import { useState } from 'react';
import { Lock, FileText, Plus } from 'lucide-react';
import VaultUploadModal from '@/components/VaultUploadModal';

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
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      {/* Header with Title and Upload Button */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">
            Encrypted Family Vault &amp; Documents
          </h3>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" /> Upload Document
        </button>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Securely stored legal wills, trust deeds, property deeds, and financial statements protected with AES-256 encryption.
      </p>

      {initialDocuments.length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-3">
          <div className="text-slate-700 dark:text-slate-300 font-bold text-sm">
            No documents uploaded to vault yet
          </div>
          <p className="text-xs text-slate-500">
            Upload statements, wills, or trust deeds using the button below.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-sm mt-1"
          >
            <Plus className="w-4 h-4" /> Upload First Document
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {initialDocuments.map((doc) => (
            <div
              key={doc.id}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-teal-500/10 border border-teal-500/20 rounded-lg text-teal-600 dark:text-teal-400 shrink-0">
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
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-white rounded-lg text-xs font-semibold shrink-0 transition-colors border border-slate-200 dark:border-slate-700"
              >
                View
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Standalone Vault Upload Modal Popup */}
      <VaultUploadModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}