'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import RetirementCalculator from '@/components/RetirementCalculator';
import { 
  fetchFamilyMembersAction, 
  addAssetAction, 
  updateAssetAction, 
  deleteAssetAction, 
  updateHouseholdBaseCurrencyAction, 
  fetchNetWorthTrendAction,
  refreshLiveMarketPricesAction 
} from '@/actions/vault';
import { 
  parseStatementAction, 
  fetchDraftLineItemsAction, 
  approveDraftLineItemAction, 
  approveAllDraftLineItemsAction, 
  rejectDraftLineItemAction 
} from '@/actions/aiStatement';
import { 
  Globe, Home, Plus, Sparkles, X, Check, CheckCheck, 
  Trash2, Cpu, Users, Target, ChevronDown, ChevronUp, FileText, 
  Edit3, LogOut, Shield, Wallet, Coins, PieChart, RefreshCw, ClipboardPaste, FileUp 
} from 'lucide-react';
import Link from 'next/link';

const FX_RATES: { [key: string]: number } = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.28,
  CAD: 0.74,
  AUD: 0.65,
  INR: 0.012,
  JPY: 0.0067,
  CHF: 1.12,
  CNY: 0.149,
};

function convertCurrency(amount: number, fromCurr: string, toCurr: string): number {
  if (fromCurr === toCurr) return amount;
  const rateFrom = FX_RATES[fromCurr] || 1;
  const rateTo = FX_RATES[toCurr] || 1;
  return (amount * rateFrom) / rateTo;
}

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

  const getAssetBaseValue = (asset: any) => {
    const val = parseFloat(asset.nativeValue || '0');
    const curr = asset.nativeCurrency || 'USD';
    return convertCurrency(val, curr, baseCurrency);
  };

  const totalNetWorth = initialAssets.reduce((s, a) => s + getAssetBaseValue(a), 0);

  const liquidAssets = initialAssets.filter(a => {
    const type = (a.assetType || '').toUpperCase();
    const category = (a.accountCategory || '').toUpperCase();
    return type !== 'REAL_ESTATE' && category !== 'SOCIAL_SECURITY' && category !== 'REAL_ESTATE';
  });
  const totalLiquidWealth = liquidAssets.reduce((s, a) => s + getAssetBaseValue(a), 0);

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
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-4 md:px-8 py-3.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 md:gap-6">
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-indigo-500/30 shrink-0 shadow-sm bg-slate-800">
                <Image
                  src="/omniwealth.jpg"
                  alt="OmniWealth Studio"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <div>
                <div className="font-extrabold text-white text-xs tracking-tight">
                  {session.household.name.replace(/ Vault$/i, '')} Vault
                </div>
                <div className="text-[10px] text-slate-400">Wealth Command</div>
              </div>
            </div>

            <div className="flex md:hidden items-center gap-1.5">
              <Link href="/" className="px-2.5 py-1 bg-slate-800 text-indigo-300 rounded-lg text-xs font-semibold">
                Dashboard
              </Link>
              <Link href="/profile" className="px-2.5 py-1 bg-slate-800 text-slate-200 rounded-lg text-xs font-medium border border-slate-700">
                Family
              </Link>
              <form action={async () => { window.location.href = '/login'; }}>
                <button type="submit" className="p-1.5 bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 border border-slate-700 rounded-lg text-xs cursor-pointer" title="Log Out">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            <nav className="hidden md:flex items-center gap-2 border-l border-slate-800 pl-6">
              <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-indigo-300 rounded-lg text-xs font-semibold shadow-sm">
                <Home className="w-3.5 h-3.5" /> Dashboard
              </Link>
              <Link href="/profile" className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-800/60 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors">
                <Users className="w-3.5 h-3.5 text-indigo-400" /> Family
              </Link>
              {session.user.role === 'SUPER_ADMIN' && (
                <Link href="/admin" className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-800/60 text-amber-300 hover:text-amber-200 rounded-lg text-xs font-medium transition-colors border border-amber-500/20">
                  <Shield className="w-3.5 h-3.5" /> Admin
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-2.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none border-t md:border-t-0 border-slate-800 pt-2 md:pt-0">
            <div className="flex items-center gap-2 shrink-0">
              <CurrencySwitcherForm currentCurrency={baseCurrency} />

              <button 
                onClick={async () => {
                  setIsSyncing(true);
                  await refreshLiveMarketPricesAction();
                  setIsSyncing(false);
                  window.location.reload();
                }} 
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-md disabled:opacity-50 shrink-0"
                title="Fetch live market prices"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Prices'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setIsAddAssetOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-md shrink-0">
                <Plus className="w-4 h-4" /><span>Add Asset</span>
              </button>

              <button onClick={() => setIsAiReaderOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-md shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" /><span>AI Reader</span>
              </button>

              <form action={async () => { window.location.href = '/login'; }} className="hidden md:block shrink-0">
                <button type="submit" className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 border border-slate-700 rounded-xl transition-colors cursor-pointer text-xs font-semibold shadow-sm" title="Log Out">
                  <LogOut className="w-3.5 h-3.5" /> <span>Logout</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-10 pt-8 space-y-8">
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
        
        <RetirementCalculator 
          currentTotalValue={totalLiquidWealth} 
          baseCurrency={baseCurrency}
          initialCurrentAge={session.household.currentAge ?? 35}
          initialRetirementAge={session.household.retirementAge ?? 65}
          initialDesiredIncome={session.household.desiredIncome ? parseFloat(session.household.desiredIncome) : undefined}
          initialCountry={session.household.retirementCountry ?? 'US'}
        />

        <FutureMilestonesAndDirectives assets={initialAssets} />
        <AccountInstructionsHub assets={initialAssets} />
      </div>

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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticCurrency, setOptimisticCurrency] = useState(currentCurrency);

  // Keep local state in sync if server prop updates
  useEffect(() => {
    setOptimisticCurrency(currentCurrency);
  }, [currentCurrency]);

  return (
    <form action={async (formData) => {
      const newCurrency = formData.get('currency') as string;
      await updateHouseholdBaseCurrencyAction(newCurrency);
      startTransition(() => {
        router.refresh();
      });
    }} className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-xl shrink-0">
      <Coins className="w-3.5 h-3.5 text-indigo-400" />
      <select 
        name="currency" 
        value={optimisticCurrency} 
        onChange={(e) => {
          setOptimisticCurrency(e.target.value); // Update UI instantly
          e.target.form?.requestSubmit();        // Trigger server update in background
        }} 
        disabled={isPending}
        className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-indigo-300 font-mono font-bold focus:outline-none cursor-pointer disabled:opacity-50"
      >
        {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'CHF', 'CNY'].map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </form>
  );
}
function FutureMilestonesAndDirectives({ assets }: { assets: any[] }) {
  const ssnAssets = assets.filter(a => a.accountCategory === 'SOCIAL_SECURITY');
  const pensionAssets = assets.filter(a => a.accountCategory === 'PENSION' || a.assetType === 'PENSION');
  const ppfAssets = assets.filter(a => a.accountCategory === 'PPF');

  const [customData, setCustomData] = useState<{ [key: string]: { amount: number; instruction: string; editing: boolean } }>({});

  if (ssnAssets.length === 0 && pensionAssets.length === 0 && ppfAssets.length === 0) {
    return null;
  }

  const getDefaultInstruction = (category: string) => {
    if (category === 'SOCIAL_SECURITY') return 'Sovereign monthly pension stream tracked separately. Excluded from liquid net worth.';
    if (category === 'PENSION') return 'Guaranteed monthly pension tier claimable via PRAN upon reaching age 60.';
    return 'Family Claiming Instruction: Submit Form H at the designated post office or bank branch upon maturity in 2031.';
  };

  const getAmount = (asset: any) => {
    if (customData[asset.id]?.amount !== undefined) return customData[asset.id].amount;
    return parseFloat(asset.nativeValue || '0');
  };

  const getInstruction = (asset: any) => {
    if (customData[asset.id]?.instruction !== undefined) return customData[asset.id].instruction;
    return getDefaultInstruction(asset.accountCategory);
  };

  const isEditing = (assetId: string) => {
    return customData[assetId]?.editing || false;
  };

  const setEditing = (assetId: string, editing: boolean) => {
    setCustomData(prev => ({
      ...prev,
      [assetId]: {
        amount: prev[assetId]?.amount ?? parseFloat(assets.find(a => a.id === assetId)?.nativeValue || '0'),
        instruction: prev[assetId]?.instruction ?? getDefaultInstruction(assets.find(a => a.id === assetId)?.accountCategory),
        editing
      }
    }));
  };

  const updateField = (assetId: string, field: 'amount' | 'instruction', value: any) => {
    setCustomData(prev => ({
      ...prev,
      [assetId]: {
        amount: field === 'amount' ? value : (prev[assetId]?.amount ?? parseFloat(assets.find(a => a.id === assetId)?.nativeValue || '0')),
        instruction: field === 'instruction' ? value : (prev[assetId]?.instruction ?? getDefaultInstruction(assets.find(a => a.id === assetId)?.accountCategory)),
        editing: true
      }
    }));
  };

  const formatVal = (val: number, currency: string) => {
    if (currency === 'INR' || currency === 'CNY') {
      return val.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    }
    return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-white uppercase">Future Income Milestones &amp; Family Directives</h3>
        </div>
      </div>
      
      <div className="space-y-3">
        {ssnAssets.map((asset) => {
          const cur = asset.nativeCurrency || 'USD';
          return (
            <div key={asset.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="w-full md:w-3/4">
                <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{asset.name || 'U.S. Social Security Benefits'}</div>
                <div className="text-sm font-semibold text-white mt-1">
                  Owner: <span className="text-indigo-300 font-medium">{asset.user?.fullName || 'Family Member'}</span> | Target Claiming Horizon: <span className="text-emerald-400 font-mono">Age 62</span>
                </div>
                {isEditing(asset.id) ? (
                  <textarea
                    value={getInstruction(asset)}
                    onChange={(e) => updateField(asset.id, 'instruction', e.target.value)}
                    className="w-full mt-2 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none resize-none"
                    rows={2}
                  />
                ) : (
                  <div className="text-xs text-slate-400 mt-0.5 max-w-xl">
                    {getInstruction(asset)}
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-3 shrink-0">
                <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-left md:text-right">
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Est. Monthly Payout</span>
                  {isEditing(asset.id) ? (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs font-mono text-emerald-400 font-bold">$</span>
                      <input
                        type="number"
                        value={getAmount(asset)}
                        onChange={(e) => updateField(asset.id, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-24 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-emerald-400 font-bold focus:outline-none"
                      />
                      <span className="text-xs text-slate-400">/mo</span>
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-emerald-400 font-bold">
                      ${formatVal(getAmount(asset), cur)} / mo
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setEditing(asset.id, !isEditing(asset.id))}
                  className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl cursor-pointer"
                  title="Edit Milestone & Instructions"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {pensionAssets.map((asset) => {
          const cur = asset.nativeCurrency || 'INR';
          return (
            <div key={asset.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="w-full md:w-3/4">
                <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{asset.name || 'Pension Plan'}</div>
                <div className="text-sm font-semibold text-white mt-1">
                  Owner: <span className="text-indigo-300 font-medium">{asset.user?.fullName || 'Family Member'}</span> | Target Maturity Horizon: <span className="text-emerald-400 font-mono">Age 60</span>
                </div>
                {isEditing(asset.id) ? (
                  <textarea
                    value={getInstruction(asset)}
                    onChange={(e) => updateField(asset.id, 'instruction', e.target.value)}
                    className="w-full mt-2 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none resize-none"
                    rows={2}
                  />
                ) : (
                  <div className="text-xs text-slate-400 mt-0.5 max-w-xl">
                    {getInstruction(asset)}
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-3 shrink-0">
                <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-left md:text-right">
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Monthly Tier Payout</span>
                  {isEditing(asset.id) ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="number"
                        value={getAmount(asset)}
                        onChange={(e) => updateField(asset.id, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-24 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-emerald-400 font-bold focus:outline-none"
                      />
                      <span className="text-xs font-mono text-slate-400">{cur} /mo</span>
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-emerald-400 font-bold">
                      {formatVal(getAmount(asset), cur)} {cur} / mo
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setEditing(asset.id, !isEditing(asset.id))}
                  className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl cursor-pointer"
                  title="Edit Milestone & Instructions"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {ppfAssets.map((asset) => {
          const cur = asset.nativeCurrency || 'INR';
          return (
            <div key={asset.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="w-full md:w-3/4">
                <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{asset.name || 'Provident Fund'}</div>
                <div className="text-sm font-semibold text-white mt-1">
                  Owner: <span className="text-indigo-300 font-medium">{asset.user?.fullName || 'Family Member'}</span> | Maturity Target: <span className="text-amber-400 font-mono">Year 2031</span>
                </div>
                {isEditing(asset.id) ? (
                  <textarea
                    value={getInstruction(asset)}
                    onChange={(e) => updateField(asset.id, 'instruction', e.target.value)}
                    className="w-full mt-2 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none resize-none"
                    rows={2}
                  />
                ) : (
                  <div className="text-xs text-slate-400 mt-0.5 max-w-xl">
                    {getInstruction(asset)}
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-3 shrink-0">
                <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-left md:text-right">
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Maturity Target Value</span>
                  {isEditing(asset.id) ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="number"
                        value={getAmount(asset)}
                        onChange={(e) => updateField(asset.id, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-24 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-emerald-400 font-bold focus:outline-none"
                      />
                      <span className="text-xs font-mono text-slate-400">{cur}</span>
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-emerald-400 font-bold">
                      {formatVal(getAmount(asset), cur)} {cur}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setEditing(asset.id, !isEditing(asset.id))}
                  className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl cursor-pointer"
                  title="Edit Milestone & Instructions"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AccountInstructionsHub({ assets }: { assets: any[] }) {
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [instructionsMap, setInstructionsMap] = useState<{ [key: string]: string }>({});
  const [editingNote, setEditingNote] = useState('');

  const uniqueAccounts = Array.from(new Set(assets.map(a => `${a.accountCategory} (${a.accountNumber || 'Primary'})`)));

  if (uniqueAccounts.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
        <Shield className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-bold text-white uppercase">Institution &amp; Account-Level Family Directives</h3>
      </div>
      <p className="text-xs text-slate-400">
        Write overarching login protocols, broker contact details, and succession steps for entire accounts holding multiple stocks or funds.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="space-y-2">
          <label className="block text-[10px] text-slate-400 uppercase font-medium">Select Account / Institution</label>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {uniqueAccounts.map((acct) => (
              <button
                key={acct}
                onClick={() => {
                  setSelectedAccount(acct);
                  setEditingNote(instructionsMap[acct] || '');
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-mono transition-colors cursor-pointer border ${
                  selectedAccount === acct 
                    ? 'bg-indigo-600/20 border-indigo-500/50 text-white font-bold' 
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                }`}
              >
                {acct}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3">
          {selectedAccount ? (
            <>
              <div>
                <div className="text-xs font-bold text-indigo-400 mb-1">Directives for: {selectedAccount}</div>
                <textarea
                  value={editingNote}
                  onChange={(e) => setEditingNote(e.target.value)}
                  placeholder="Enter succession notes, broker estate desk info, or multi-stock transfer instructions..."
                  rows={4}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setInstructionsMap(prev => ({ ...prev, [selectedAccount]: editingNote }));
                    alert('Account instructions saved!');
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg cursor-pointer shadow-md transition-colors"
                >
                  Save Account Notes
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-slate-500 py-8">
              Select an account from the left to view or edit master family instructions.
            </div>
          )}
        </div>
      </div>
    </div>
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
    const val = convertCurrency(parseFloat(a.nativeValue || '0'), a.nativeCurrency || 'USD', baseCurrency);
    typeMap[t] = (typeMap[t] || 0) + val;
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
                  <div className="font-mono text-xs text-emerald-400 font-semibold">{Math.round(val).toLocaleString()} {baseCurrency}</div>
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
            <div><label className="block text-[10px] text-slate-400 mb-1">Ticker</label><input name="ticker" placeholder="AAPL or XAU" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Asset Type</label>
              <select name="assetType" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white">
                <option value="STOCK">Stock</option>
                <option value="CRYPTO">Crypto</option>
                <option value="COMMODITY">Commodity / Gold</option>
                <option value="CASH">Cash</option>
                <option value="FIXED_INCOME">Fixed Income / PF / PPF</option>
                <option value="PENSION">Pension</option>
                <option value="HSA">HSA</option>
                <option value="REAL_ESTATE">Real Estate</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Account Category</label>
              <select name="accountCategory" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white">
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
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm overflow-y-auto flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-5xl shadow-2xl max-h-[90vh] overflow-y-auto my-auto relative">
        
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

        <form onSubmit={handleUpload} className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="bg-slate-900 border border-slate-800 rounded p-1 text-white">
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

  const getBaseVal = (valStr: string, curr: string) => {
    return convertCurrency(parseFloat(valStr || '0'), curr || 'USD', baseCurrency);
  };

  const totalNetWorth = assets.reduce((s, a) => s + getBaseVal(a.nativeValue, a.nativeCurrency), 0);

  const categorySubtotals: { [key: string]: number } = {};
  assets.forEach((a) => {
    const rawCat = a.accountCategory || 'INDIVIDUAL';
    const label = ['IRA', 'ROTH_IRA', '401K'].includes(rawCat) ? 'Retirement' : rawCat;
    categorySubtotals[label] = (categorySubtotals[label] || 0) + getBaseVal(a.nativeValue, a.nativeCurrency);
  });
  const sortedCategories = Object.entries(categorySubtotals).sort((a, b) => b[1] - a[1]);

  const memberMap: { [key: string]: { total: number; assets: any[] } } = {};
  assets.forEach((a) => {
    const name = a.user?.fullName || 'Family General';
    if (!memberMap[name]) memberMap[name] = { total: 0, assets: [] };
    memberMap[name].total += getBaseVal(a.nativeValue, a.nativeCurrency);
    memberMap[name].assets.push(a);
  });
  Object.keys(memberMap).forEach(name => {
    memberMap[name].assets.sort((a, b) => getBaseVal(b.nativeValue, b.nativeCurrency) - getBaseVal(a.nativeValue, a.nativeCurrency));
  });
  const sortedMembers = Object.entries(memberMap).sort((a, b) => b[1].total - a[1].total);

  const purposeMap: { [key: string]: { total: number; assets: any[] } } = {};
  assets.forEach((a) => {
    const p = a.rationale || legacyPillars[0]?.name || 'General Long-Term Growth';
    if (!purposeMap[p]) purposeMap[p] = { total: 0, assets: [] };
    purposeMap[p].total += getBaseVal(a.nativeValue, a.nativeCurrency);
    purposeMap[p].assets.push(a);
  });
  Object.keys(purposeMap).forEach(p => {
    purposeMap[p].assets.sort((a, b) => getBaseVal(b.nativeValue, b.nativeCurrency) - getBaseVal(a.nativeValue, a.nativeCurrency));
  });
  const sortedPurposes = Object.entries(purposeMap).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-xs uppercase tracking-wider text-indigo-400 font-semibold flex items-center gap-1.5">
              <Wallet className="w-4 h-4" /> Global Household Net Worth
            </span>
            <div className="text-3xl font-extrabold font-mono text-white mt-1">
              {Math.round(totalNetWorth).toLocaleString()} <span className="text-indigo-400 text-lg">{baseCurrency}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {sortedCategories.map(([cat, val]) => (
              <div key={cat} className="bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-xl text-xs">
                <span className="text-slate-400 uppercase text-[10px] block">{cat}</span>
                <span className="font-mono text-emerald-400 font-bold">{Math.round(val).toLocaleString()} {baseCurrency}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800"><Users className="w-5 h-5 text-indigo-400" /><h3 className="text-sm font-bold text-white uppercase">Family Member Sub-Totals</h3></div>
          <div className="space-y-3">
            {sortedMembers.map(([name, data]) => (
              <div key={name} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <button onClick={() => setExpM(p => ({ ...p, [name]: !p[name] }))} className="w-full p-4 flex justify-between items-center text-left hover:bg-slate-900/50 cursor-pointer">
                  <div><div className="font-bold text-white text-sm">{name}</div><div className="text-xs text-slate-400">{data.assets.length} holding(s)</div></div>
                  <div className="flex items-center gap-3"><span className="font-mono text-emerald-400 font-semibold">{Math.round(data.total).toLocaleString()} {baseCurrency}</span>{expM[name] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}</div>
                </button>
                {expM[name] && (
                  <div className="border-t border-slate-900 p-4 space-y-2 bg-slate-950/80">
                    {data.assets.map((asset) => (
                      <div key={asset.id} className="bg-slate-900/70 border border-slate-800 p-3 rounded-lg text-xs flex justify-between items-center">
                        {editingId === asset.id ? (
                          <form action={async (fd) => { await updateAssetAction(asset.id, fd); setEditingId(null); }} className="w-full space-y-2">
                            <input name="name" defaultValue={asset.name} className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white" />
                            <div className="grid grid-cols-2 gap-2">
                              <input name="nativeValue" type="number" step="any" defaultValue={asset.nativeValue} className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white font-mono" />
                              <select name="rationale" defaultValue={asset.rationale} className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-white cursor-pointer">
                                {legacyPillars.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                              </select>
                            </div>
                            <div className="flex justify-end gap-1"><button type="button" onClick={() => setEditingId(null)} className="p-1 bg-slate-800 rounded text-slate-300"><X className="w-3 h-3" /></button><button type="submit" className="p-1 bg-emerald-600 rounded text-white"><Check className="w-3 h-3" /></button></div>
                          </form>
                        ) : (
                          <>
                            <div><span className="font-bold text-white">{asset.name}</span> <span className="text-[10px] text-indigo-300">({asset.accountCategory})</span></div>
                            <div className="flex items-center gap-2"><span className="font-mono text-emerald-400 font-semibold">{Math.round(getBaseVal(asset.nativeValue, asset.nativeCurrency)).toLocaleString()} {baseCurrency}</span><button onClick={() => setEditingId(asset.id)} className="text-slate-400 hover:text-indigo-400"><Edit3 className="w-3.5 h-3.5" /></button><button onClick={async () => { await deleteAssetAction(asset.id); }} className="text-slate-400 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button></div>
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

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800"><Target className="w-5 h-5 text-indigo-400" /><h3 className="text-sm font-bold text-white uppercase">Purpose &amp; Legacy Instructions</h3></div>
          <div className="space-y-3">
            {sortedPurposes.map(([purposeName, data]) => {
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
                      <span className="font-mono text-emerald-400 font-semibold">{Math.round(data.total).toLocaleString()} {baseCurrency}</span>
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
                          <span className="font-mono text-emerald-400 font-semibold">{Math.round(getBaseVal(a.nativeValue, a.nativeCurrency)).toLocaleString()} {baseCurrency}</span>
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