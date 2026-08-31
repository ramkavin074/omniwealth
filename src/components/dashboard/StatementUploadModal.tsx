'use client';

import { useState, useEffect } from 'react';
import { 
  parseStatementAction, 
  fetchDraftLineItemsAction, 
  approveDraftLineItemAction, 
  approveAllDraftLineItemsAction, 
  rejectDraftLineItemAction 
} from '@/actions/aiStatement';
import { Cpu, X, Sparkles, FileUp, ClipboardPaste, CheckCheck, Check, Trash2 } from 'lucide-react';
import { formatCompact } from '@/lib/format';

export default function StatementUploadModal({ legacyPillars, members, onClose }: any) {
  const [uploading, setUploading] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [bulkUser, setBulkUser] = useState(members[0]?.id);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    try {
      const data = await fetchDraftLineItemsAction();
      setDrafts(data);
    } catch (err) { 
      console.error('Failed to load draft line items:', err); 
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (members.length > 0 && !bulkUser) { setBulkUser(members[0].id); } }, [members]);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    setError('');
    setSuccessMsg('');
    try {
      const formData = new FormData(e.currentTarget);
      const res = await parseStatementAction(formData);
      if (res?.success) {
        setSuccessMsg(`Successfully extracted ${res.count} items! Review below.`);
        (e.target as HTMLFormElement).reset();
        await loadData();
      } else { setError(res?.error || 'Failed to parse statements or text.'); }
    } catch (err: any) { 
      console.error('Statement upload error:', err);
      setError(err.message || 'An unexpected error occurred.'); 
    } finally { 
      setUploading(false); 
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs overflow-y-auto flex items-center justify-center p-4 print:hidden">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-5xl shadow-xl max-h-[90vh] overflow-y-auto my-auto relative text-slate-900 dark:text-white">
        {uploading && (
          <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs z-30 rounded-2xl flex flex-col items-center justify-center gap-3 text-center p-6">
            <div className="w-10 h-10 border-4 border-teal-700 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-slate-900 dark:text-white font-bold text-sm">Processing Statement with Gemini AI...</div>
            <div className="text-slate-500 dark:text-slate-400 text-xs max-w-sm">Reading document tables, extracting tickers, and calculating asset values.</div>
          </div>
        )}
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">AI Statement Intelligence &amp; Review Locker</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        {error && <div className="text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-3 rounded-lg mb-4">{error}</div>}
        {successMsg && <div className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-3 rounded-lg mb-4">{successMsg}</div>}
        <form onSubmit={handleUpload} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-6 space-y-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl flex flex-col justify-between shadow-sm">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                <FileUp className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>Upload PDF or Image Statements</span>
              </label>
              <input name="files" type="file" multiple accept=".pdf,image/*" className="w-full text-xs text-slate-600 dark:text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-700 file:text-white cursor-pointer" />
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl flex flex-col justify-between shadow-sm">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                <ClipboardPaste className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>Or Paste Statement Text / Holdings</span>
              </label>
              <textarea name="pastedText" rows={3} placeholder="Paste account holdings, table rows, or statement text here..." className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-slate-400 resize-none shadow-sm" />
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
            <button type="submit" disabled={uploading} className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-xl cursor-pointer disabled:opacity-50 shadow-sm transition-colors flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{uploading ? 'Analyzing with Gemini...' : 'Extract & Parse with AI'}</span>
            </button>
          </div>
        </form>
        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 pb-2 border-b border-slate-200 dark:border-slate-800 gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Pending Extracted Items ({drafts.length})</h3>
            {drafts.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Assign Owner For All:</span>
                <select value={bulkUser} onChange={(e) => setBulkUser(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-3 py-1.5 text-xs text-slate-900 dark:text-white cursor-pointer font-medium shadow-sm">
                  {members.map((m: any) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
                </select>
                <button onClick={async () => { 
                  setUploading(true); 
                  try { 
                    await approveAllDraftLineItemsAction(bulkUser); 
                    await loadData(); 
                    setSuccessMsg("Successfully approved all pending items!"); 
                  } catch (err) { 
                    console.error('Failed to approve all items:', err);
                    setError("Failed to approve items."); 
                  } finally { 
                    setUploading(false); 
                  } 
                }} className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg cursor-pointer shadow-sm">
                  <CheckCheck className="w-4 h-4" /><span>Approve All Pending</span>
                </button>
              </div>
            )}
          </div>
          {drafts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950">No pending items. Upload statements or paste text above!</div>
          ) : (
            <div className="space-y-3">
              {drafts.map((item: any) => <DraftItemRow key={item.id} item={item} members={members} legacyPillars={legacyPillars} onRefresh={loadData} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DraftItemRow({ item, members, legacyPillars, onRefresh }: any) {
  const [cat, setCat] = useState(item.accountCategory || 'INDIVIDUAL');
  const [usr, setUsr] = useState(item.userId || members[0]?.id);
  const [acct, setAcct] = useState(item.accountNumber || 'DEFAULT');
  const [rat, setRat] = useState(item.rationale || legacyPillars[0]?.name);

  return (
    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
      <div className="flex justify-between items-center">
        <div>
          <span className="font-bold text-slate-900 dark:text-white text-sm">{item.assetName}</span> {item.ticker && <span className="text-xs font-mono text-slate-600 dark:text-slate-400">({item.ticker})</span>}
          <div className="text-xs font-mono text-slate-900 dark:text-white font-semibold">{formatCompact(parseFloat(item.totalNativeValue), item.nativeCurrency)} {item.nativeCurrency}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => { 
            try {
              await approveDraftLineItemAction(item.id, cat, usr, acct, rat); 
              onRefresh(); 
            } catch (err) {
              console.error('Failed to approve draft item:', err);
            }
          }} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 text-white rounded text-xs cursor-pointer shadow-sm"><Check className="w-4 h-4" /> Approve</button>
          <button onClick={async () => { 
            try {
              await rejectDraftLineItemAction(item.id); 
              onRefresh(); 
            } catch (err) {
              console.error('Failed to reject draft item:', err);
            }
          }} className="p-1.5 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 border border-slate-200 dark:border-slate-700 rounded cursor-pointer shadow-sm"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
        <select value={usr} onChange={(e) => setUsr(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-slate-900 dark:text-white shadow-sm">{members.map((m: any) => <option key={m.id} value={m.id}>{m.fullName}</option>)}</select>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-slate-900 dark:text-white shadow-sm">
          <option value="INDIVIDUAL">Individual</option>
          <option value="IRA">Traditional IRA</option>
          <option value="ROTH_IRA">Roth IRA</option>
          <option value="401K">401(k)</option>
          <option value="HSA">HSA</option>
          <option value="PPF">PPF</option>
          <option value="PF">PF / EPF</option>
          <option value="PENSION">Pension</option>
          <option value="SOCIAL_SECURITY">Social Security</option>
          <option value="529">529 College</option>
          <option value="TRUST">Trust</option>
          <option value="REAL_ESTATE">Real Estate</option>
        </select>
        <input value={acct} onChange={(e) => setAcct(e.target.value)} placeholder="Acct #" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-slate-900 dark:text-white font-mono shadow-sm" />
        <select value={rat} onChange={(e) => setRat(e.target.value)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-slate-900 dark:text-white cursor-pointer shadow-sm">
          {legacyPillars.map((p: any) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </div>
    </div>
  );
}