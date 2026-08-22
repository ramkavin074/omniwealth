'use client';

import { useState, useEffect } from 'react';
import { 
  fetchFamilyMembersAction, 
  parseStatementAction, 
  fetchDraftLineItemsAction, 
  approveDraftLineItemAction, 
  approveAllDraftLineItemsAction, 
  rejectDraftLineItemAction, 
  addAssetAction, 
  updateAssetAction, 
  deleteAssetAction, 
  updateHouseholdBaseCurrencyAction, 
  fetchNetWorthTrendAction,
  refreshLiveMarketPricesAction 
} from '@/actions/vault';
import { 
  Globe, User, Home, Plus, Sparkles, X, Check, CheckCheck, 
  Trash2, Cpu, Users, Target, ChevronDown, ChevronUp, FileText, 
  Edit3, Calculator, LogOut, Shield, Wallet, Coins, PieChart, RefreshCw, ClipboardPaste, FileUp 
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardClient({ session, initialAssets, baseCurrency }: { session: any; initialAssets: any[]; baseCurrency: string }) {
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [isAiReaderOpen, setIsAiReaderOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<{ month: string; value: number }[]>([]);
  const [timeRange, setTimeRange] = useState('6m');

  useEffect(() => {
    fetchFamilyMembersAction().then(setMembers);
  }, []);

  useEffect(() => {
    fetchNetWorthTrendAction(timeRange).then(setTrendData);
  }, [timeRange]);

  const totalNetWorth = initialAssets.reduce((s, a) => s + parseFloat(a.nativeValue || '0'), 0);
  const firstName = session?.user?.fullName ? session.user.fullName.split(' ')[0] : 'User';

  let legacyPillars: { name: string; description: string }[] = [];
  try {
    legacyPillars = JSON.parse(session?.household?.legacyPillars || '[]');
  } catch (e) {
    legacyPillars = [
      { name: 'Core Growth & Accumulation', description: '' },
      { name: 'Retirement & Income Preservation', description: '' },
      { name: 'Succession & Education', description: '' },
      { name: 'General Long-Term Growth', description: '' },
    ];
  }

  if (legacyPillars.length === 0) {
    legacyPillars = [{ name: 'General Long-Term Growth', description: '' }];
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-16 relative">
      {/* Sleek Command Header */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-6 py-3 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
                🌐
              </div>
              <div>
                <div className="font-extrabold text-white text-xs tracking-tight">
                  {session.household.name.replace(/ Vault$/i, '')} Vault
                </div>
                <div className="text-[10px] text-slate-400">Wealth Command</div>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-1.5 border-l border-slate-800 pl-4">
              <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-indigo-300 rounded-lg text-xs font-semibold shadow-sm">
                <Home className="w-3.5 h-3.5" /> Dashboard
              </Link>
              <Link href="/profile" className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-800/60 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors">
                <Users className="w-3.5 h-3.5 text-indigo-400" /> Family &amp; Profile
              </Link>
              {session.user.role === 'SUPER_ADMIN' && (
                <Link href="/admin" className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-800/60 text-amber-300 hover:text-amber-200 rounded-lg text-xs font-medium transition-colors border border-amber-500/20">
                  <Shield className="w-3.5 h-3.5" /> Admin
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <CurrencySwitcherForm currentCurrency={baseCurrency} />

            <button 
              onClick={async () => {
                setIsSyncing(true);
                await refreshLiveMarketPricesAction();
                setIsSyncing(false);
                window.location.reload();
              }} 
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-md disabled:opacity-50"
              title="Fetch live market stock and crypto prices"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Prices'}</span>
            </button>

            <button onClick={() => setIsAddAssetOpen(true)} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-md">
              <Plus className="w-4 h-4" /><span>Add Asset</span>
            </button>
            <button onClick={() => setIsAiReaderOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-md">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" /><span>AI Reader</span>
            </button>

            <form action={async () => { window.location.href = '/login'; }}>
              <button type="submit" className="flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 border border-slate-700 rounded-xl transition-colors cursor-pointer text-xs font-semibold shadow-sm" title="Log Out">
                <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Logout</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 md:px-10 pt-8 space-y-8">
        <div className="flex items-center justify-between pb-2 border-b border-slate-900">
          <div>
            <h1 className="text-lg font-bold text-white">Welcome back, {firstName} 👋</h1>
            <p className="text-xs text-slate-400">Here is your consolidated family wealth and asset overview.</p>
          </div>
          <span className="hidden sm:inline-block text-[11px] font-mono px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-indigo-300">
            Role: {session.user.role}
          </span>
        </div>

        <WealthSummaryDashboard assets={initialAssets} baseCurrency={baseCurrency} legacyPillars={legacyPillars} />
        <AssetAllocationVisualizer assets={initialAssets} baseCurrency={baseCurrency} totalNetWorth={totalNetWorth} />
        <NetWorthTrendChart trendData={trendData} baseCurrency={baseCurrency} timeRange={timeRange} setTimeRange={setTimeRange} />
        <GrowthSimulator currentTotalValue={totalNetWorth} baseCurrency={baseCurrency} />
      </div>

      {/* Root-Level Modals */}
      {isAddAssetOpen && (
        <AddAssetModal legacyPillars={legacyPillars} members={members} onClose={() => setIsAddAssetOpen(false)} />
      )}

      {isAiReaderOpen && (
        <StatementUploadModal legacyPillars={legacyPillars} members={members} onClose={() => setIsAiReaderOpen(false)} />
      )}
    </main>
  );
}

function CurrencySwitcherForm({ currentCurrency }: { currentCurrency: string }) {
  return (
    <form action={async (formData) => {
      await updateHouseholdBaseCurrencyAction(formData.get('currency') as string);
    }} className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-xl">
      <Coins className="w-3.5 h-3.5 text-indigo-400" />
      <select name="currency" defaultValue={currentCurrency} onChange={(e) => e.target.form?.requestSubmit()} className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-indigo-300 font-mono font-bold focus:outline-none cursor-pointer">
        {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'CHF'].map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </form>
  );
}

function NetWorthTrendChart({ trendData = [], baseCurrency, timeRange, setTimeRange }: { trendData: { month: string; value: number }[]; baseCurrency: string; timeRange: string; setTimeRange: (val: string) => void }) {
  const safeData = Array.isArray(trendData) ? trendData : [];
  const maxValue = safeData.length > 0 ? Math.max(...safeData.map(d => d?.value || 1), 1) : 1;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-white uppercase">Historical Net Worth Trend</h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase text-slate-400 font-medium">Timeline:</span>
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)} 
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-indigo-300 font-mono font-bold focus:outline-none cursor-pointer"
          >
            <option value="1m">Last 1 Month</option>
            <option value="3m">Last 3 Months</option>
            <option value="6m">Last 6 Months</option>
            <option value="1y">Last 1 Year</option>
            <option value="3y">Last 3 Years</option>
            <option value="5y">Last 5 Years</option>
            <option value="10y">Last 10 Years</option>
            <option value="15y">Last 15 Years</option>
            <option value="20y">Last 20 Years</option>
          </select>
        </div>
      </div>

      <div className="pt-6 pb-2 px-2 border-b border-slate-800/80">
        {safeData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-xs text-slate-500 font-mono">
            Loading timeline data...
          </div>
        ) : (
          <div className="h-48 flex items-end justify-between gap-1.5 overflow-x-auto pb-1">
            {safeData.map((item, idx) => {
              const val = item?.value || 0;
              const heightPct = Math.round((val / maxValue) * 100);
              const tooltipText = `${item?.month || ''}: ${val.toLocaleString()} ${baseCurrency}`;
               
              return (
                <div 
                  key={idx} 
                  title={tooltipText}
                  className="flex-1 min-w-[32px] flex flex-col items-center gap-2 h-full justify-end group cursor-pointer"
                >
                  <div 
                    style={{ height: `${Math.max(heightPct, 6)}%` }}
                    className="w-full max-w-[40px] bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all duration-300 group-hover:from-indigo-400 group-hover:to-emerald-400 shadow-md"
                  />
                  <span className="text-[9px] font-mono text-slate-400 truncate max-w-full">{item?.month || ''}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AssetAllocationVisualizer({ assets, baseCurrency, totalNetWorth }: { assets: any[]; baseCurrency: string; totalNetWorth: number }) {
  const typeMap: { [key: string]: number } = {};
   
  assets.forEach((a) => {
    let t = (a.assetType || 'OTHER').toUpperCase().trim();
    if (t === 'EQUITY') t = 'EQUITIES';
    typeMap[t] = (typeMap[t] || 0) + parseFloat(a.nativeValue || '0');
  });

  const sortedEntries = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);
  const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-cyan-500', 'bg-rose-500'];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
        <PieChart className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-bold text-white uppercase">Asset Class Allocation</h3>
      </div>

      {totalNetWorth === 0 ? (
        <div className="text-center py-6 text-slate-500 text-xs">No assets available for allocation view.</div>
      ) : (
        <div className="space-y-4">
          <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
            {sortedEntries.map(([type, val], idx) => {
              const pct = (val / totalNetWorth) * 100;
              return (
                <div 
                  key={type} 
                  style={{ width: `${pct}%` }} 
                  className={`${colors[idx % colors.length]} transition-all duration-500`}
                  title={`${type}: ${pct.toFixed(1)}%`}
                />
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
            {sortedEntries.map(([type, val], idx) => {
              const pct = totalNetWorth > 0 ? ((val / totalNetWorth) * 100).toFixed(1) : '0';
              return (
                <div key={type} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${colors[idx % colors.length]}`} />
                    <span className="text-[11px] font-bold text-slate-300 uppercase truncate">{type}</span>
                  </div>
                  <div className="font-mono text-xs text-emerald-400 font-semibold">{val.toLocaleString()} {baseCurrency}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{pct}% of portfolio</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AddAssetModal({ legacyPillars, members, onClose }: { legacyPillars: { name: string; description: string }[]; members: any[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm overflow-y-auto flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl my-auto">
        <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-800">
          <h2 className="text-base font-bold text-white">Add Asset Manually</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <form action={async (fd) => { await addAssetAction(fd); onClose(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] text-slate-400 mb-1">Asset Name</label><input name="name" required placeholder="e.g. Apple Stock" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white" /></div>
            <div><label className="block text-[10px] text-slate-400 mb-1">Ticker</label><input name="ticker" placeholder="AAPL or BTC" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Asset Type</label>
              <select name="assetType" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white">
                <option value="STOCK">Stock</option><option value="CRYPTO">Crypto</option><option value="CASH">Cash</option><option value="REAL_ESTATE">Real Estate</option><option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Account Category</label>
              <select name="accountCategory" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white">
                <option value="INDIVIDUAL">Individual</option><option value="IRA">Traditional IRA</option><option value="ROTH_IRA">Roth IRA</option><option value="401K">401(k)</option><option value="529">529 College</option><option value="TRUST">Trust</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-[10px] text-slate-400 mb-1">Quantity / Shares</label><input name="quantity" type="number" step="any" defaultValue="1" required className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono" /></div>
            <div><label className="block text-[10px] text-slate-400 mb-1">Total Value</label><input name="nativeValue" type="number" step="any" required placeholder="10000" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono" /></div>
            <div><label className="block text-[10px] text-slate-400 mb-1">Currency</label><input name="nativeCurrency" defaultValue="USD" required className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] text-slate-400 mb-1">Acct # (Last 4)</label><input name="accountNumber" defaultValue="DEFAULT" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono" /></div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Owner</label>
              <select name="userId" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white">
                {members.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1">Strategic Rationale &amp; Legacy Pillar</label>
            <select name="rationale" defaultValue={legacyPillars[0]?.name} required className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white cursor-pointer">
              {legacyPillars.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs cursor-pointer">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer">Save Asset</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StatementUploadModal({ legacyPillars, members, onClose }: { legacyPillars: { name: string; description: string }[]; members: any[]; onClose: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [bulkUser, setBulkUser] = useState(members[0]?.id);

  const loadData = async () => {
    const data = await fetchDraftLineItemsAction();
    setDrafts(data);
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (members.length > 0 && !bulkUser) {
      setBulkUser(members[0].id);
    }
  }, [members]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm overflow-y-auto flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-5xl shadow-2xl max-h-[90vh] overflow-y-auto my-auto">
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">AI Statement Intelligence &amp; Review Locker</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {/* Dual Input Form: File Upload OR Paste Text */}
        <form 
          action={async (fd) => { 
            setUploading(true); 
            await parseStatementAction(fd); 
            await loadData(); 
            setUploading(false); 
          }} 
          className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-6 space-y-4"
        >
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
                  onClick={async () => { setUploading(true); await approveAllDraftLineItemsAction(bulkUser); await loadData(); setUploading(false); }} 
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

function DraftItemRow({ item, members, legacyPillars, onRefresh }: { item: any; members: any[]; legacyPillars: { name: string; description: string }[]; onRefresh: () => void }) {
  const [cat, setCat] = useState(item.accountCategory || 'INDIVIDUAL');
  const [usr, setUsr] = useState(item.userId || members[0]?.id);
  const [acct, setAcct] = useState(item.accountNumber || 'DEFAULT');
  const [rat, setRat] = useState(item.rationale || legacyPillars[0]?.name);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <div>
          <span className="font-bold text-white text-sm">{item.assetName}</span> {item.ticker && <span className="text-xs font-mono text-indigo-400">({item.ticker})</span>}
          <div className="text-xs font-mono text-emerald-400 font-semibold">{parseFloat(item.totalNativeValue).toLocaleString()} {item.nativeCurrency}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => { await approveDraftLineItemAction(item.id, cat, usr, acct, rat); onRefresh(); }} className="flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white rounded text-xs cursor-pointer"><Check className="w-3.5 h-3.5" /> Approve</button>
          <button onClick={async () => { await rejectDraftLineItemAction(item.id); onRefresh(); }} className="p-1 bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 rounded cursor-pointer"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-900 text-xs">
        <select value={usr} onChange={(e) => setUsr(e.target.value)} className="bg-slate-900 border border-slate-800 rounded p-1 text-white">{members.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}</select>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="bg-slate-900 border border-slate-800 rounded p-1 text-white"><option value="INDIVIDUAL">Individual</option><option value="IRA">Traditional IRA</option><option value="ROTH_IRA">Roth IRA</option><option value="401K">401(k)</option><option value="529">529 College</option><option value="TRUST">Trust</option></select>
        <input value={acct} onChange={(e) => setAcct(e.target.value)} placeholder="Acct #" className="bg-slate-900 border border-slate-800 rounded p-1 text-white font-mono" />
        <select value={rat} onChange={(e) => setRat(e.target.value)} className="bg-slate-900 border border-slate-800 rounded p-1 text-white cursor-pointer">
          {legacyPillars.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </div>
    </div>
  );
}

function WealthSummaryDashboard({ assets, baseCurrency, legacyPillars }: { assets: any[]; baseCurrency: string; legacyPillars: { name: string; description: string }[] }) {
  const [expM, setExpM] = useState<{ [key: string]: boolean }>({});
  const [expP, setExpP] = useState<{ [key: string]: boolean }>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const totalNetWorth = assets.reduce((s, a) => s + parseFloat(a.nativeValue || '0'), 0);

  const categorySubtotals: { [key: string]: number } = {};
  assets.forEach((a) => {
    const rawCat = a.accountCategory || 'INDIVIDUAL';
    const label = ['IRA', 'ROTH_IRA', '401K'].includes(rawCat) ? 'Retirement' : rawCat;
    categorySubtotals[label] = (categorySubtotals[label] || 0) + parseFloat(a.nativeValue || '0');
  });

  const memberMap: { [key: string]: { total: number; assets: any[] } } = {};
  assets.forEach((a) => {
    const name = a.user?.fullName || 'Family General';
    if (!memberMap[name]) memberMap[name] = { total: 0, assets: [] };
    memberMap[name].total += parseFloat(a.nativeValue || '0');
    memberMap[name].assets.push(a);
  });

  const purposeMap: { [key: string]: { total: number; assets: any[] } } = {};
  assets.forEach((a) => {
    const p = a.rationale || legacyPillars[0]?.name || 'General Long-Term Growth';
    if (!purposeMap[p]) purposeMap[p] = { total: 0, assets: [] };
    purposeMap[p].total += parseFloat(a.nativeValue || '0');
    purposeMap[p].assets.push(a);
  });

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-xs uppercase tracking-wider text-indigo-400 font-semibold flex items-center gap-1.5">
              <Wallet className="w-4 h-4" /> Global Household Net Worth
            </span>
            <div className="text-3xl font-extrabold font-mono text-white mt-1">
              {totalNetWorth.toLocaleString()} <span className="text-indigo-400 text-lg">{baseCurrency}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.entries(categorySubtotals).map(([cat, val]) => (
              <div key={cat} className="bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-xl text-xs">
                <span className="text-slate-400 uppercase text-[10px] block">{cat}</span>
                <span className="font-mono text-emerald-400 font-bold">{val.toLocaleString()} {baseCurrency}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Family Members Sub-Totals */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800"><Users className="w-5 h-5 text-indigo-400" /><h3 className="text-sm font-bold text-white uppercase">Family Member Sub-Totals</h3></div>
          <div className="space-y-3">
            {Object.entries(memberMap).map(([name, data]) => (
              <div key={name} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <button onClick={() => setExpM(p => ({ ...p, [name]: !p[name] }))} className="w-full p-4 flex justify-between items-center text-left hover:bg-slate-900/50 cursor-pointer">
                  <div><div className="font-bold text-white text-sm">{name}</div><div className="text-xs text-slate-400">{data.assets.length} holding(s)</div></div>
                  <div className="flex items-center gap-3"><span className="font-mono text-emerald-400 font-semibold">{data.total.toLocaleString()} {baseCurrency}</span>{expM[name] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}</div>
                </button>
                {expM[name] && (
                  <div className="border-t border-slate-900 p-4 space-y-2 bg-slate-950/80">
                    {data.assets.map((asset) => (
                      <div key={asset.id} className="bg-slate-900/70 border border-slate-800 p-3 rounded-lg text-xs flex justify-between items-center">
                        {editingId === asset.id ? (
                          <form action={async (fd) => { await updateAssetAction(asset.id, fd); setEditingId(null); }} className="w-full space-y-2">
                            <input name="name" defaultValue={asset.name} className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white" />
                            <div className="grid grid-cols-2 gap-2">
                              <input name="nativeValue" type="number" step="any" defaultValue={asset.nativeValue} className="bg-slate-950 border border-slate-800 rounded p-1 text-white font-mono" />
                              <select name="rationale" defaultValue={asset.rationale} className="bg-slate-950 border border-slate-800 rounded p-1 text-white cursor-pointer">
                                {legacyPillars.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                              </select>
                            </div>
                            <div className="flex justify-end gap-1"><button type="button" onClick={() => setEditingId(null)} className="p-1 bg-slate-800 rounded text-slate-300"><X className="w-3 h-3" /></button><button type="submit" className="p-1 bg-emerald-600 rounded text-white"><Check className="w-3 h-3" /></button></div>
                          </form>
                        ) : (
                          <>
                            <div><span className="font-bold text-white">{asset.name}</span> <span className="text-[10px] text-indigo-300">({asset.accountCategory})</span></div>
                            <div className="flex items-center gap-2"><span className="font-mono text-emerald-400 font-semibold">{parseFloat(asset.nativeValue || '0').toLocaleString()} {baseCurrency}</span><button onClick={() => setEditingId(asset.id)} className="text-slate-400 hover:text-indigo-400"><Edit3 className="w-3.5 h-3.5" /></button><button onClick={async () => { await deleteAssetAction(asset.id); }} className="text-slate-400 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button></div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Purpose & Legacy Sub-Totals */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800"><Target className="w-5 h-5 text-indigo-400" /><h3 className="text-sm font-bold text-white uppercase">Purpose &amp; Legacy Instructions</h3></div>
          <div className="space-y-3">
            {Object.entries(purposeMap).map(([purposeName, data]) => {
              const matchedPillar = legacyPillars.find(p => p.name === purposeName);
              const description = matchedPillar?.description;

              return (
                <div key={purposeName} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <button onClick={() => setExpP(p => ({ ...p, [purposeName]: !p[purposeName] }))} className="w-full p-4 flex justify-between items-center text-left hover:bg-slate-900/50 cursor-pointer">
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>{purposeName}
                      </div>
                      <div className="text-xs text-slate-400">{data.assets.length} account(s)</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-emerald-400 font-semibold">{data.total.toLocaleString()} {baseCurrency}</span>
                      {expP[purposeName] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>
                  {expP[purposeName] && (
                    <div className="border-t border-slate-900 p-4 space-y-3 bg-slate-950/80 text-xs">
                      {description && (
                        <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3 text-slate-200 space-y-1">
                          <div className="flex items-center gap-1.5 text-indigo-400 font-bold mb-1">
                            <FileText className="w-3.5 h-3.5" />
                            <span className="uppercase text-[10px]">Legacy Directive:</span>
                          </div>
                          <p className="text-slate-200 font-medium">{description}</p>
                        </div>
                      )}
                      {data.assets.map(a => (
                        <div key={a.id} className="flex justify-between items-center bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                          <span className="font-bold text-white">{a.name}</span>
                          <span className="font-mono text-emerald-400 font-semibold">{parseFloat(a.nativeValue || '0').toLocaleString()} {baseCurrency}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function GrowthSimulator({ currentTotalValue, baseCurrency }: { currentTotalValue: number; baseCurrency: string }) {
  const [returnRate, setReturnRate] = useState(7);
  const [years, setYears] = useState(10);
  const [monthly, setMonthly] = useState(500);

  const r = returnRate / 100 / 12;
  const n = years * 12;
  const fv = Math.round(currentTotalValue * Math.pow(1 + r, n) + (r > 0 ? monthly * ((Math.pow(1 + r, n) - 1) / r) : monthly * n));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800"><Calculator className="w-5 h-5 text-indigo-400" /><h3 className="text-sm font-bold text-white uppercase">Future Wealth &amp; Growth Simulation</h3></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 text-xs">
        <div><label className="block text-slate-400 mb-1">Return ({returnRate}%)</label><input type="range" min="1" max="20" step="0.5" value={returnRate} onChange={(e) => setReturnRate(parseFloat(e.target.value))} className="w-full accent-indigo-500" /></div>
        <div><label className="block text-slate-400 mb-1">Horizon ({years} Yrs)</label><input type="range" min="1" max="40" value={years} onChange={(e) => setYears(parseInt(e.target.value))} className="w-full accent-indigo-500" /></div>
        <div><label className="block text-slate-400 mb-1">Monthly Addition</label><input type="number" value={monthly} onChange={(e) => setMonthly(parseFloat(e.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white font-mono" /></div>
      </div>
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex justify-between items-center text-xs">
        <div>
          <div className="text-slate-400">Projected Portfolio Value</div>
          <div className="text-2xl font-extrabold font-mono text-emerald-400">{fv.toLocaleString()} <span className="text-sm text-indigo-400">{baseCurrency}</span></div>
        </div>
      </div>
    </div>
  );
}