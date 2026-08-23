function StatementUploadModal({ legacyPillars, members, onClose }: { legacyPillars: { name: string; description: string }[]; members: any[]; onClose: () => void }) {
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
      console.error(err);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (members.length > 0 && !bulkUser) {
      setBulkUser(members[0].id);
    }
  }, [members]);

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
      } else {
        setError(res?.error || 'Failed to parse statements or text.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setUploading(false); // Guarantees loading spinner turns off
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm overflow-y-auto flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-5xl shadow-2xl max-h-[90vh] overflow-y-auto my-auto relative">
        
        {/* Active Processing Loading Overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-30 rounded-2xl flex flex-col items-center justify-center gap-3 text-center p-6">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-white font-bold text-sm">Processing Statement with Gemini AI...</div>
            <div className="text-slate-400 text-xs max-w-sm">Reading document tables, extracting tickers, and calculating asset values. This will just take a moment.</div>
          </div>
        )}

        <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">AI Statement Intelligence &amp; Review Locker</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
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
                className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white cursor-pointer" 
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
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl cursor-pointer disabled:opacity-50 shadow-md transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{uploading ? 'Analyzing with Gemini...' : 'Extract & Parse with AI'}</span>
            </button>
          </div>
        </form>

        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 pb-2 border-b border-slate-800 gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Pending Extracted Items ({drafts.length})</h3>
            {drafts.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 uppercase font-medium">Assign Owner For All:</span>
                <select 
                  value={bulkUser} 
                  onChange={(e) => setBulkUser(e.target.value)} 
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white cursor-pointer font-medium"
                >
                  {members.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
                </select>
                <button 
                  onClick={async () => { 
                    setUploading(true); 
                    try {
                      await approveAllDraftLineItemsAction(bulkUser); 
                      await loadData(); 
                      setSuccessMsg("Successfully approved all pending items!");
                    } catch(err: any) {
                      setError("Failed to approve items.");
                    } finally {
                      setUploading(false);
                    }
                  }} 
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg cursor-pointer shadow-md"
                >
                  <CheckCheck className="w-4 h-4" /><span>Approve All Pending</span>
                </button>
              </div>
            )}
          </div>

          {drafts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
              No pending items. Upload statements or paste text above!
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.map((item) => (
                <DraftItemRow key={item.id} item={item} members={members} legacyPillars={legacyPillars} onRefresh={loadData} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}