'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchDocumentDownloadUrlAction, deleteDocumentAction } from '@/actions/vault';
import { Lock, Plus, FileText, Trash2 } from 'lucide-react';

export default function SecureDocumentsVault({ documents = [], onOpenUpload, embedded = false }: any) {
  const router = useRouter();
  const [viewingId, setViewingId] = useState<string | null>(null);

  async function handleView(docId: string) {
    setViewingId(docId);
    try {
      const res = await fetchDocumentDownloadUrlAction(docId);
      if (res.success && res.dataUri) {
        const newWindow = window.open();
        if (newWindow) {
          newWindow.document.write(`
            <html>
              <head><title>${res.name || 'Secure Document'}</title></head>
              <body style="margin:0; background:#0f172a; display:flex; align-items:center; justify-content:center; height:100vh;">
                <iframe src="${res.dataUri}" style="width:100%; height:100%; border:none;"></iframe>
              </body>
            </html>
          `);
        } else {
          const a = document.createElement('a');
          a.href = res.dataUri;
          a.download = res.name || 'document';
          a.click();
        }
      } else {
        alert(res.error || 'Failed to decrypt document.');
      }
    } catch (err) {
      console.error('An error occurred while opening the document:', err);
      alert('An error occurred while opening the document.');
    } finally {
      setViewingId(null);
    }
  }

  async function handleDelete(docId: string) {
    if (confirm('Are you sure you want to delete this document from the secure vault?')) {
      try {
        const res = await deleteDocumentAction(docId);
        if (res.success) {
          router.refresh();
        } else {
          alert(res.error || 'Failed to delete document');
        }
      } catch (err) {
        console.error('Failed to delete document:', err);
      }
    }
  }

  return (
    <div className={embedded ? 'space-y-4' : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4'}>
      <div className={`flex items-center ${embedded ? 'justify-end' : 'justify-between pb-3 border-b border-slate-200 dark:border-slate-800'}`}>
        {!embedded && (
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Encrypted Family Vault &amp; Documents</h3>
          </div>
        )}
        <button onClick={onOpenUpload} className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-xl transition cursor-pointer shadow-sm">
          <Plus className="w-4 h-4" /><span>Upload Document</span>
        </button>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Securely stored legal wills, trust deeds, property deeds, and financial statements protected with AES-256 encryption.
      </p>

      {documents.length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-3">
          <div className="text-slate-800 dark:text-slate-200 font-bold text-sm">No documents uploaded to vault yet</div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">Upload statements, wills, or trust deeds using the button below.</p>
          <button onClick={onOpenUpload} className="mt-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-xl transition cursor-pointer shadow-sm inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Upload First Document
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {documents.map((doc: any) => (
            <div key={doc.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 shrink-0 shadow-sm">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-white text-sm truncate">{doc.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {doc.fileType || 'PDF'} {doc.fileSize ? `• ${doc.fileSize}` : ''} • {new Date(doc.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => handleView(doc.id)} disabled={viewingId === doc.id} className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer disabled:opacity-50">
                  {viewingId === doc.id ? 'Decrypting...' : 'View'}
                </button>
                <button onClick={() => handleDelete(doc.id)} title="Delete Document" className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-slate-200 dark:border-slate-700 transition cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}