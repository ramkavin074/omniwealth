'use client';

import { useState, useTransition, useRef } from 'react';
import { uploadDocumentAction, fetchDocumentDownloadUrlAction, deleteDocumentAction } from '@/actions/vault';

interface DocumentVaultProps {
  initialDocuments: any[];
}

export default function DocumentVaultSection({ initialDocuments }: DocumentVaultProps) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Stable form reference using useRef to prevent null errors
  const formRef = useRef<HTMLFormElement>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;

    if (!file || file.size === 0) {
      setErrorMessage('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setErrorMessage(null);

    try {
      const res = await uploadDocumentAction(formData);
      setUploading(false);

      if (res?.success) {
        // Safely reset using the stable useRef hook
        formRef.current?.reset();
        window.location.reload();
      } else {
        setErrorMessage(res?.error || 'Failed to upload document. The file may exceed size limits.');
      }
    } catch (err: any) {
      setUploading(false);
      setErrorMessage(err.message || 'Network error or file too large.');
    }
  }

  async function handleDownload(docId: string) {
    const res = await fetchDocumentDownloadUrlAction(docId);
    if (res?.success && res.dataUri) {
      const link = document.createElement('a');
      link.href = res.dataUri;
      link.download = res.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert(res?.error || 'Decryption failed.');
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm('Are you sure you want to delete this encrypted document?')) return;
    startTransition(async () => {
      await deleteDocumentAction(docId);
      window.location.reload();
    });
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-slate-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Secure Document Vault</h2>
          <p className="text-sm text-slate-300">
            Military-grade AES-256-GCM encrypted storage for sensitive financial statements, deeds, and tax records.
          </p>
        </div>

        {/* Upload Form attached to formRef */}
        <form ref={formRef} onSubmit={handleUpload} className="flex items-center gap-2 flex-wrap">
          <input 
            type="file" 
            name="file" 
            required 
            className="text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-500/20 file:text-indigo-300 hover:file:bg-indigo-500/30"
          />
          <button 
            type="submit" 
            disabled={uploading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-xl text-sm transition shadow-sm disabled:opacity-50 whitespace-nowrap"
          >
            {uploading ? 'Encrypting & Uploading...' : 'Upload & Encrypt'}
          </button>
        </form>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 bg-red-950/50 text-red-300 text-sm rounded-xl border border-red-800">
          {errorMessage}
        </div>
      )}

      {/* Document List Table */}
      {documents.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
          <p className="text-sm text-slate-400">No secure documents uploaded yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs">
              <tr>
                <th className="py-3 px-4 rounded-l-xl">Document Name</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Encryption Status</th>
                <th className="py-3 px-4 text-right rounded-r-xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                    🔒 {doc.name}
                  </td>
                  <td className="py-3 px-4 text-slate-400">{doc.fileSize || 'Unknown'}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                      AES-256-GCM Secure
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleDownload(doc.id)}
                      className="text-indigo-400 hover:text-indigo-300 font-medium text-xs px-3 py-1.5 bg-indigo-950/50 hover:bg-indigo-900/50 rounded-lg transition"
                    >
                      Decrypt & Download
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={isPending}
                      className="text-red-400 hover:text-red-300 font-medium text-xs px-3 py-1.5 bg-red-950/50 hover:bg-red-900/50 rounded-lg transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}