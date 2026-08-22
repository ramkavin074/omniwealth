'use client';

import { useState, useEffect } from 'react';
import { parseStatementAction, fetchDraftLineItemsAction, approveDraftLineItemAction, approveAllDraftLineItemsAction, rejectDraftLineItemAction } from '@/actions/aiStatement';
import { fetchFamilyMembersAction } from '@/actions/auth';
import { FileUp, X, Check, CheckCheck, Trash2, Cpu, Sparkles, Users, ClipboardPaste } from 'lucide-react';

export default function StatementUploadModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [bulkUserId, setBulkUserId] = useState('');
  const [editedCategories, setEditedCategories] = useState<{ [key: string]: string }>({});
  const [editedUsers, setEditedUsers] = useState<{ [key: string]: string }>({});
  const [editedAccountNumbers, setEditedAccountNumbers] = useState<{ [key: string]: string }>({});
  const [editedRationales, setEditedRationales] = useState<{ [key: string]: string }>({});

  const loadDraftsAndMembers = async () => {
    try {
      const items = await fetchDraftLineItemsAction();
      setDrafts(items || []);
      const family = await fetchFamilyMembersAction();
      setMembers(family || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDraftsAndMembers();
    }
  }, [isOpen]);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    setError('');
    setSuccessMsg('');

    const formData = new FormData(e.currentTarget);
    const res = await parseStatementAction(formData);

    if (res?.success) {
      setSuccessMsg(`Successfully extracted ${res.count} items from your statements/text! Review below.`);
      (e.target as HTMLFormElement).reset();
      loadDraftsAndMembers();
    } else {
      setError(res?.error || 'Failed to parse statements or text');
    }
    setUploading(false);
  }

  async function handleApprove(draftId: string) {
    const category = editedCategories[draftId];
    const userId = editedUsers[draftId];
    const accountNumber = editedAccountNumbers[draftId];
    const rationale = editedRationales[draftId];
    await approveDraftLineItemAction(draftId, category, userId, accountNumber, rationale);
    loadDraftsAndMembers();
  }

  async function handleApproveAll() {
    setUploading(true);
    const res = await approveAllDraftLineItemsAction(bulkUserId || undefined);
    if (res?.success) {
      setSuccessMsg(`Successfully approved all ${res.count} items into your global vault!`);
      loadDraftsAndMembers();
    } else {
      setError('Failed to approve all items.');
    }
    setUploading(false);
  }

  async function handleReject(draftId: string) {
    await rejectDraftLineItemAction(draftId);
    loadDraftsAndMembers();
  }

  const handleBulkAssignUser = (userId: string) => {
    setBulkUserId(userId);
    const updatedUsers: { [key: string]: string } = {};
    drafts.forEach((item) => {
      updatedUsers[item.id] = userId;
    });
    setEditedUsers(updatedUsers);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-md"
      >
        <Sparkles className="w-4 h-4 text-indigo-400" />
        <span>Statement AI Reader</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-5xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">AI Statement Intelligence &amp; Legacy Vault Review</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && <div className="text-xs text-rose-400 bg-rose-950/50 border border-rose-800 p-2.5 rounded-lg mb-4">{error}</div>}
            {successMsg && <div className="text-xs text-emerald-400 bg-emerald-950/50 border border-emerald-800 p-2.5 rounded-lg mb-4">{successMsg}</div>}

            {/* Dual Input Form: File Upload OR Paste Text */}
            <form onSubmit={handleUpload} className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* File Upload Option */}
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-2">
                    <FileUp className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Upload PDF or Image Statements</span>
                  </label>
                  <input
                    name="files"
                    type="file"
                    multiple
                    accept=".pdf,image/*"
                    className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                  />
                </div>

                {/* Paste Text Option */}
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-2">
                    <ClipboardPaste className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Or Paste Statement Text / Holdings</span>
                  </label>
                  <textarea
                    name="pastedText"
                    rows={3}
                    placeholder="Paste account holdings, table rows, or statement text here..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-900">
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl cursor-pointer transition-colors disabled:opacity-50 shadow-md flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Analyzing with Gemini...' : 'Extract & Parse with AI'}</span>
                </button>
              </div>
            </form>

            {/* Pending Items List */}
            <div>
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 mb-3 pb-2 border-b border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Pending Extracted Items ({drafts.length})
                </h3>

                {drafts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg">
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-[10px] text-slate-400 font-medium">Assign all to:</span>
                      <select
                        value={bulkUserId}
                        onChange={(e) => handleBulkAssignUser(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="" disabled>Select family member...</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>{m.fullName}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleApproveAll}
                      disabled={uploading}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-md"
                    >
                      <CheckCheck className="w-4 h-4" />
                      <span>Approve All Pending</span>
                    </button>
                  </div>
                )}
              </div>

              {drafts.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  No pending extracted line items. Upload statements or paste text above to begin!
                </div>
              ) : (
                <div className="space-y-4">
                  {drafts.map((item) => (
                    <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-sm">{item.assetName}</span>
                            {item.ticker && <span className="text-xs font-mono text-indigo-400">({item.ticker})</span>}
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">{item.assetType}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="font-mono text-emerald-400 font-semibold">
                              {parseFloat(item.totalNativeValue).toLocaleString()} {item.nativeCurrency}
                            </span>
                            <span className="text-slate-500">|</span>
                            <span className="text-slate-400 text-[11px]">
                              Acct # (Last 4): <span className="font-mono text-slate-200">{item.accountNumber}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleApprove(item.id)}
                            className="flex items-center gap-1 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg cursor-pointer transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleReject(item.id)}
                            className="p-1.5 bg-slate-900 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 border border-slate-800 rounded-lg cursor-pointer transition-colors"
                            title="Reject"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-900">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Owner</label>
                          <select
                            value={editedUsers[item.id] || item.userId || ''}
                            onChange={(e) => setEditedUsers({ ...editedUsers, [item.id]: e.target.value })}
                            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 w-full focus:outline-none focus:border-indigo-500"
                          >
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>{m.fullName}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Category</label>
                          <select
                            value={editedCategories[item.id] || item.accountCategory || 'INDIVIDUAL'}
                            onChange={(e) => setEditedCategories({ ...editedCategories, [item.id]: e.target.value })}
                            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 w-full focus:outline-none focus:border-indigo-500"
                          >
                            <option value="INDIVIDUAL">Individual</option>
                            <option value="IRA">Traditional IRA</option>
                            <option value="ROTH_IRA">Roth IRA</option>
                            <option value="401K">401(k)</option>
                            <option value="529">529 College</option>
                            <option value="TRUST">Trust</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Acct # (Last 4)</label>
                          <input
                            type="text"
                            value={editedAccountNumbers[item.id] !== undefined ? editedAccountNumbers[item.id] : (item.accountNumber || 'DEFAULT')}
                            onChange={(e) => setEditedAccountNumbers({ ...editedAccountNumbers, [item.id]: e.target.value })}
                            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 w-full font-mono focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Strategic Rationale &amp; Legacy Purpose</label>
                        <input
                          type="text"
                          value={editedRationales[item.id] !== undefined ? editedRationales[item.id] : (item.rationale || 'General Long-Term Growth')}
                          onChange={(e) => setEditedRationales({ ...editedRationales, [item.id]: e.target.value })}
                          placeholder="e.g. Education fund; if unused, convert to IRA or reallocate"
                          className="bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200 w-full font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}