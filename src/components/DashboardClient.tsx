'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import RetirementCalculator from '@/components/RetirementCalculator';
import { 
  fetchFamilyMembersAction, 
  addAssetAction, 
  updateAssetAction, 
  deleteAssetAction, 
  updateHouseholdBaseCurrencyAction, 
  fetchNetWorthTrendAction,
  refreshLiveMarketPricesAction,
  fetchLiveExchangeRatesAction,
  logoutAction 
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
  Edit3, LogOut, Shield, Wallet, Coins, PieChart, RefreshCw, ClipboardPaste, FileUp, CreditCard, Settings, Lock, Menu, TrendingUp, Calendar, ArrowRight 
} from 'lucide-react';

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

function convertCurrency(amount: number, fromCurr: string, toCurr: string, rates: { [key: string]: number } = FX_RATES): number {
  if (fromCurr === toCurr) return amount;
  const rateFrom = rates[fromCurr] || 1;
  const rateTo = rates[toCurr] || 1;
  return (amount * rateTo) / rateFrom;
}

interface DashboardClientProps {
  session: any;
  initialAssets: any[];
  baseCurrency: string;
  initialDocuments?: any[];
  initialLiveRates?: { [key: string]: number };
}

export default function DashboardClient({ 
  session, 
  initialAssets, 
  baseCurrency, 
  initialDocuments = [],
  initialLiveRates = FX_RATES
}: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<'wealth' | 'liabilities' | 'retirement' | 'directives' | 'feed'>('wealth');
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [isAddLiabilityOpen, setIsAddLiabilityOpen] = useState(false);
  const [isAiReaderOpen, setIsAiReaderOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'privacy' | 'terms' | 'faq' | 'about' | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<{ month: string; value: number }[]>([]);
  const [timeRange, setTimeRange] = useState('6m');
  const [liveRates, setLiveRates] = useState<{ [key: string]: number }>(initialLiveRates);

  useEffect(() => {
    fetchFamilyMembersAction().then(setMembers);
  }, []);

  useEffect(() => {
    fetchNetWorthTrendAction(timeRange).then(setTrendData);
  }, [timeRange]);

  useEffect(() => {
    fetchLiveExchangeRatesAction().then(setLiveRates).catch(() => {});
  }, []);

  useEffect(() => {
    const handleUrlOpen = async (data: { url: string }) => {
      if (data.url && data.url.startsWith('com.omniwealth.app')) {
        try {
          await Browser.close();
        } catch (e) {
          console.warn('Browser was already closed', e);
        }
      }
    };
    App.addListener('appUrlOpen', handleUrlOpen);
    return () => { App.removeAllListeners(); };
  }, []);

  const getAssetBaseValue = (asset: any) => {
    const val = parseFloat(asset.nativeValue || '0');
    const curr = asset.nativeCurrency || 'USD';
    const baseVal = convertCurrency(val, curr, baseCurrency, liveRates);
    const type = (asset.assetType || '').toUpperCase();
    const cat = (asset.accountCategory || '').toUpperCase();
    
    if (type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY' || cat === 'DEBT') {
      return -Math.abs(baseVal);
    }
    return Math.abs(baseVal);
  };

  const totalNetWorth = initialAssets.reduce((s: number, a: any) => s + getAssetBaseValue(a), 0);
  const liquidAssets = initialAssets.filter(a => {
    const type = (a.assetType || '').toUpperCase();
    const category = (a.accountCategory || '').toUpperCase();
    return type !== 'REAL_ESTATE' && category !== 'SOCIAL_SECURITY' && type !== 'LIABILITY';
  });
  const totalLiquidWealth = liquidAssets.reduce((s: number, a: any) => s + getAssetBaseValue(a), 0);

  let legacyPillars: { name: string; description: string }[] = [];
  try {
    legacyPillars = JSON.parse(session?.household?.legacyPillars || '[]');
  } catch {
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
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-20 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      <div>
        {/* ========================================================= */}
        {/* UNIFIED HEADER & SUMMARY                                  */}
        {/* ========================================================= */}
        <UnifiedHeaderAndSummary
          session={session}
          initialAssets={initialAssets}
          baseCurrency={baseCurrency}
          liveRates={liveRates}
          onOpenMenu={() => setIsMobileMenuOpen(true)}
          onOpenAddAsset={() => setIsAddAssetOpen(true)}
          onOpenLiability={() => setIsAddLiabilityOpen(true)}
          onOpenAiReader={() => setIsAiReaderOpen(true)}
          onSelectTab={(tab: any) => setActiveTab(tab)}
        />

        {/* ========================================================= */}
        {/* MOBILE SLIDE-OUT NAVIGATION DRAWER                        */}
        {/* ========================================================= */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div 
              className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
              onClick={() => setIsMobileMenuOpen(false)} 
            />

            <div className="relative w-4/5 max-w-xs bg-slate-900 text-white h-full shadow-2xl z-10 flex flex-col justify-between p-6 border-r border-slate-800 overflow-y-auto">
              <div className="space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-xs">OW</div>
                    <span className="font-bold text-sm tracking-wide text-indigo-200">OmniWealth</span>
                  </div>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Action Buttons routing to respective individual tabs */}
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => { setActiveTab('wealth'); setIsAddAssetOpen(true); setIsMobileMenuOpen(false); }}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /><span>Add Asset</span>
                  </button>
                  <button 
                    onClick={() => { setActiveTab('liabilities'); setIsAddLiabilityOpen(true); setIsMobileMenuOpen(false); }}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs rounded-xl shadow cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" /><span>Liability</span>
                  </button>
                </div>

                <nav className="flex flex-col space-y-1.5 pt-2">
                  <button 
                    onClick={() => { setActiveTab('wealth'); setIsMobileMenuOpen(false); }} 
                    className={`flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeTab === 'wealth' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'hover:bg-slate-800 text-slate-300'}`}
                  >
                    <Home className="w-4 h-4 text-indigo-300" />
                    <span>Home / Portfolio</span>
                  </button>

                  <button 
                    onClick={() => { setIsAiReaderOpen(true); setIsMobileMenuOpen(false); }} 
                    className="flex items-center justify-between py-3 px-3.5 rounded-xl text-xs font-semibold cursor-pointer hover:bg-slate-800 text-slate-300 transition-colors"
                  >
                    <div className="flex items-center space-x-3.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>AI Statement Reader</span>
                    </div>
                    <span className="bg-amber-500 text-black text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow">NEW</span>
                  </button>

                  <button 
                    onClick={() => { setActiveTab('liabilities'); setIsMobileMenuOpen(false); }} 
                    className={`flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeTab === 'liabilities' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'hover:bg-slate-800 text-slate-300'}`}
                  >
                    <CreditCard className="w-4 h-4 text-rose-400" />
                    <span>Liabilities &amp; Debt</span>
                  </button>

                  <button 
                    onClick={() => { setActiveTab('retirement'); setIsMobileMenuOpen(false); }} 
                    className={`flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeTab === 'retirement' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'hover:bg-slate-800 text-slate-300'}`}
                  >
                    <Target className="w-4 h-4 text-emerald-400" />
                    <span>Retirement &amp; Planning</span>
                  </button>

                  <button 
                    onClick={() => { setActiveTab('directives'); setIsMobileMenuOpen(false); }} 
                    className={`flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeTab === 'directives' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'hover:bg-slate-800 text-slate-300'}`}
                  >
                    <Shield className="w-4 h-4 text-cyan-400" />
                    <span>Directives &amp; Vault</span>
                  </button>

                  <button 
                    onClick={() => { setActiveTab('feed'); setIsMobileMenuOpen(false); }} 
                    className={`flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeTab === 'feed' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'hover:bg-slate-800 text-slate-300'}`}
                  >
                    <TrendingUp className="w-4 h-4 text-teal-400" />
                    <span>Intelligence Feed</span>
                  </button>
                </nav>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-2.5">
                <Link href="/profile" onClick={() => setIsMobileMenuOpen(false)} className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700">
                  <span className="flex items-center gap-2"><Settings className="w-3.5 h-3.5 text-indigo-400" /> Household Settings</span>
                </Link>
                {session.user.role === 'SUPER_ADMIN' && (
                  <Link href="/admin" onClick={() => setIsMobileMenuOpen(false)} className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold rounded-xl border border-amber-500/20">
                    <span className="flex items-center gap-2"><Shield className="w-3.5 h-3.5" /> Admin Portal</span>
                  </Link>
                )}
                <form action={logoutAction} className="pt-1">
                  <button type="submit" className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-rose-950/60 text-rose-400 text-xs font-semibold rounded-xl border border-rose-900/50 hover:bg-rose-900/50 cursor-pointer">
                    <LogOut className="w-3.5 h-3.5" /> Logout
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 space-y-6">
          {/* ========================================================= */}
          {/* DESKTOP TAB NAVIGATION BAR                                */}
          {/* ========================================================= */}
          <div className="hidden md:flex bg-slate-900 border border-slate-800 p-1.5 rounded-2xl items-center gap-2 overflow-x-auto shadow-md">
            <button onClick={() => setActiveTab('wealth')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${activeTab === 'wealth' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}>
              <Wallet className="w-4 h-4" /> Wealth &amp; Assets
            </button>
            <button onClick={() => setActiveTab('liabilities')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${activeTab === 'liabilities' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}>
              <CreditCard className="w-4 h-4" /> Liabilities &amp; Debt
            </button>
            <button onClick={() => setActiveTab('retirement')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${activeTab === 'retirement' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}>
              <Target className="w-4 h-4" /> Retirement &amp; Planning
            </button>
            <button onClick={() => setActiveTab('directives')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${activeTab === 'directives' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}>
              <Shield className="w-4 h-4" /> Directives &amp; Vault
            </button>
            <button onClick={() => setActiveTab('feed')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${activeTab === 'feed' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}>
              <Sparkles className="w-4 h-4 text-indigo-300" /> Intelligence Feed
            </button>
          </div>

          <div className="space-y-6">
            {activeTab === 'wealth' && (
              <div className="space-y-6 animate-fadeIn">
                <WealthSummaryDashboard assets={initialAssets} baseCurrency={baseCurrency} legacyPillars={legacyPillars} liveRates={liveRates} />
                <AssetAllocationVisualizer assets={initialAssets} baseCurrency={baseCurrency} totalNetWorth={totalNetWorth} liveRates={liveRates} />
                <NetWorthTrendChart trendData={trendData} baseCurrency={baseCurrency} timeRange={timeRange} setTimeRange={setTimeRange} />
              </div>
            )}

            {activeTab === 'liabilities' && (
              <div className="space-y-6 animate-fadeIn">
                <LiabilitiesManagementSection assets={initialAssets} baseCurrency={baseCurrency} liveRates={liveRates} onAddLiability={() => setIsAddLiabilityOpen(true)} />
              </div>
            )}

            {activeTab === 'retirement' && (
              <div className="space-y-6 animate-fadeIn">
                <RetirementCalculator 
                  currentTotalValue={totalLiquidWealth} 
                  baseCurrency={baseCurrency}
                  initialCurrentAge={session.household.currentAge ?? 35}
                  initialRetirementAge={session.household.retirementAge ?? 65}
                  initialDesiredIncome={session.household.desiredIncome ? parseFloat(session.household.desiredIncome) : undefined}
                  initialCountry={session.household.retirementCountry ?? 'US'}
                />
              </div>
            )}

            {activeTab === 'directives' && (
              <div className="space-y-6 animate-fadeIn">
                <FutureMilestonesAndDirectives assets={initialAssets} />
                <AccountInstructionsHub assets={initialAssets} />
                <SecureDocumentsVault documents={initialDocuments} />
              </div>
            )}

            {activeTab === 'feed' && (
              <div className="space-y-6 animate-fadeIn">
                <IntelligenceFeed assets={initialAssets} trendData={trendData} baseCurrency={baseCurrency} documents={initialDocuments} />
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="max-w-7xl mx-auto w-full px-4 md:px-8 mt-20 pt-8 border-t border-slate-800 text-slate-400 text-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-center md:text-left space-y-1">
          <div>&copy; 2026 OmniWealth. All rights reserved.</div>
          <div className="text-[10px] text-slate-500 max-w-xl">
            Disclaimer: OmniWealth is a global family asset command and tracking platform for informational purposes only and does not constitute professional financial, tax, or legal advice.
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 font-medium text-slate-300">
          <button onClick={() => setActiveModal('about')} className="hover:text-indigo-400 transition-colors cursor-pointer">About</button>
          <span>•</span>
          <button onClick={() => setActiveModal('faq')} className="hover:text-indigo-400 transition-colors cursor-pointer">FAQ</button>
          <span>•</span>
          <button onClick={() => setActiveModal('privacy')} className="hover:text-indigo-400 transition-colors cursor-pointer">Privacy Policy</button>
          <span>•</span>
          <button onClick={() => setActiveModal('terms')} className="hover:text-indigo-400 transition-colors cursor-pointer">Terms of Service</button>
        </div>
      </footer>

      {isAddAssetOpen && (
        <AddAssetModal legacyPillars={legacyPillars} members={members} onClose={() => setIsAddAssetOpen(false)} isLiability={false} />
      )}

      {isAddLiabilityOpen && (
        <AddAssetModal legacyPillars={legacyPillars} members={members} onClose={() => setIsAddLiabilityOpen(false)} isLiability={true} />
      )}

      {isAiReaderOpen && (
        <StatementUploadModal legacyPillars={legacyPillars} members={members} onClose={() => setIsAiReaderOpen(false)} />
      )}

      {activeModal && (
        <LegalInfoModal type={activeModal} onClose={() => setActiveModal(null)} />
      )}
    </main>
  );
}

// ========================================================= //
// UNIFIED HEADER & SUMMARY                                  //
// ========================================================= //
function UnifiedHeaderAndSummary({ session, initialAssets, baseCurrency, liveRates, onOpenMenu, onOpenAddAsset, onOpenLiability, onOpenAiReader, onSelectTab }: any) {
  const router = useRouter();
  const [isRefreshing, startRefreshTransition] = useTransition();

  const handleRefreshPrices = () => {
    startRefreshTransition(async () => {
      try {
        await refreshLiveMarketPricesAction();
        await fetchLiveExchangeRatesAction();
        router.refresh();
      } catch (err) {
        console.error('Failed to refresh live market prices:', err);
      }
    });
  };

  const getBaseVal = (asset: any) => {
    const val = parseFloat(asset.nativeValue || '0');
    const curr = asset.nativeCurrency || 'USD';
    const baseVal = convertCurrency(val, curr, baseCurrency, liveRates);
    const type = (asset.assetType || '').toUpperCase();
    const cat = (asset.accountCategory || '').toUpperCase();
    if (type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY' || cat === 'DEBT') {
      return -Math.abs(baseVal);
    }
    return Math.abs(baseVal);
  };

  const totalNetWorth = initialAssets.reduce((s: number, a: any) => s + getBaseVal(a), 0);
  const userName = session?.user?.fullName || session?.user?.email || 'Valued User';
  const householdTitle = session?.household?.name ? session.household.name.replace(/ Vault$/i, '') : 'Vault';

  const categorySubtotals: { [key: string]: number } = {};
  initialAssets.forEach((a: any) => {
    const rawCat = a.accountCategory || 'INDIVIDUAL';
    const label = ['IRA', 'ROTH_IRA', '401K'].includes(rawCat) ? 'Retirement' : rawCat;
    categorySubtotals[label] = (categorySubtotals[label] || 0) + getBaseVal(a);
  });
  const sortedCategories = Object.entries(categorySubtotals).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      {/* Top Header Bar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-4 md:px-8 py-3.5 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button 
              onClick={onOpenMenu} 
              className="md:hidden p-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl cursor-pointer hover:bg-slate-700 transition"
              aria-label="Open Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link href="/" className="flex items-center gap-2.5 group cursor-pointer min-w-0">
              <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-indigo-500/30 shrink-0 bg-slate-800 flex items-center justify-center font-bold text-indigo-400 text-xs">
                OW
              </div>
              <div className="min-w-0">
                <div className="font-bold text-white text-xs md:text-sm tracking-tight truncate">
                  {householdTitle} {<span className="hidden md:inline">Vault</span>}
                </div>
                <div className="text-[10px] text-slate-400">Command Center</div>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <CurrencySwitcherForm currentCurrency={baseCurrency} />
            
            {/* Desktop Quick Actions & Profile Controls */}
            <div className="hidden md:flex items-center gap-2">
              <button onClick={onOpenAddAsset} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition cursor-pointer shadow-md">
                <Plus className="w-4 h-4" /><span>Add Asset</span>
              </button>
              <button onClick={onOpenLiability} className="flex items-center gap-1.5 px-3 py-2 bg-rose-600/80 hover:bg-rose-600 text-white font-semibold text-xs rounded-xl transition cursor-pointer shadow-md">
                <CreditCard className="w-4 h-4" /><span>Add Liability</span>
              </button>
              <button onClick={onOpenAiReader} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 font-semibold text-xs rounded-xl transition cursor-pointer shadow-md">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" /><span>AI Reader</span>
              </button>

              {/* Refresh Live Prices Button */}
              <button 
                onClick={handleRefreshPrices} 
                disabled={isRefreshing}
                title="Refresh Live Market Prices & Exchange Rates" 
                className="p-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-xl border border-indigo-500/30 transition cursor-pointer disabled:opacity-50 shadow-md"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>

              <div className="h-5 w-[1px] bg-slate-800 mx-1" />

              {/* Desktop Settings Link */}
              <Link href="/profile" title="Household Settings" className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition cursor-pointer">
                <Settings className="w-4 h-4" />
              </Link>

              {/* Desktop Admin Portal (if Super Admin) */}
              {session.user.role === 'SUPER_ADMIN' && (
                <Link href="/admin" title="Admin Portal" className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 rounded-xl border border-amber-500/30 transition cursor-pointer">
                  <Shield className="w-4 h-4" />
                </Link>
              )}

              {/* Desktop Logout Button */}
              <form action={logoutAction}>
                <button type="submit" title="Logout" className="p-2 bg-rose-950/60 hover:bg-rose-900/60 text-rose-400 hover:text-rose-300 rounded-xl border border-rose-900/50 transition cursor-pointer">
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* MOBILE COMPACT SUMMARY BAR (TOTAL & REFRESH)              */}
      {/* ========================================================= */}
      <div className="block md:hidden px-4 pt-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Global Net Worth</span>
            <div className="text-xl font-black font-mono text-white truncate">
              {Math.round(totalNetWorth).toLocaleString()} <span className="text-xs font-sans font-normal text-emerald-400">{baseCurrency}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={handleRefreshPrices} 
              disabled={isRefreshing}
              title="Refresh Live Market Prices" 
              className="p-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-xl border border-slate-700 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onOpenAddAsset}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /><span>Add</span>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Persistent Summary Bar */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 md:px-8">
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex justify-between items-center">
          <div>
            <span className="text-xs uppercase tracking-wider text-indigo-400 font-semibold flex items-center gap-1.5">
              <Wallet className="w-4 h-4" /> Global Household Net Worth
            </span>
            <div className="text-4xl font-extrabold font-mono text-white mt-1">
              {Math.round(totalNetWorth).toLocaleString()} <span className="text-indigo-400 text-lg font-sans">{baseCurrency}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {sortedCategories.map(([cat, val]) => (
              <div key={cat} className="bg-slate-950/80 border border-slate-800 px-3.5 py-2 rounded-xl text-xs shadow-inner">
                <span className="text-slate-400 uppercase text-[10px] block font-medium">{cat}</span>
                <span className={`font-mono font-bold ${val < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {Math.round(val).toLocaleString()} {baseCurrency}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function IntelligenceFeed({ assets, trendData, baseCurrency, documents }: { assets: any[]; trendData: { month: string; value: number }[]; baseCurrency: string; documents: any[] }) {
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('omniwealth_dismissed_feed');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const handleDismiss = (id: string) => {
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('omniwealth_dismissed_feed', JSON.stringify(updated)); } catch {}
    }
  };

  const safeData = Array.isArray(trendData) ? trendData : [];
  const currentVal = safeData[safeData.length - 1]?.value || 0;
  const previousVal = safeData[safeData.length - 2]?.value || currentVal;
  const growthAmount = currentVal - previousVal;
  const growthPercent = previousVal > 0 ? (growthAmount / previousVal) * 100 : 0;
  const isGrowthRealistic = growthAmount > 0 && growthAmount <= currentVal && growthPercent <= 100;
  const milestoneAssets = assets.filter(a => ['SOCIAL_SECURITY', 'PENSION', 'PPF'].includes(a.accountCategory));

  const feedItems = [];
  if (isGrowthRealistic) {
    feedItems.push({
      id: 'perf-growth',
      type: 'success',
      icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
      title: 'Portfolio Progress Update',
      message: `Great job! Your household net worth grew by +${growthPercent.toFixed(1)}% (${Math.round(growthAmount).toLocaleString()} ${baseCurrency}) this month.`,
      badge: 'Performance',
      border: 'border-emerald-500/30 bg-emerald-950/20',
    });
  }

  milestoneAssets.forEach((asset) => {
    feedItems.push({
      id: `milestone-${asset.id}`,
      type: 'milestone',
      icon: <Calendar className="w-4 h-4 text-indigo-400" />,
      title: `Future Income Stream: ${asset.name}`,
      message: `Owner: ${asset.user?.fullName || 'Family Member'}. Logged value stands at ${parseFloat(asset.nativeValue || '0').toLocaleString()} ${asset.nativeCurrency || baseCurrency}.`,
      badge: 'Milestone',
      border: 'border-indigo-500/30 bg-indigo-950/20',
    });
  });

  if (documents.length === 0) {
    feedItems.push({
      id: 'vault-empty',
      type: 'warning',
      icon: <Lock className="w-4 h-4 text-amber-400" />,
      title: 'Secure Document Vault Empty',
      message: 'You have not uploaded any wills, trust deeds, or physical statements to your AES-256 encrypted vault yet.',
      badge: 'Action Required',
      border: 'border-amber-500/30 bg-amber-950/20',
    });
  } else {
    feedItems.push({
      id: 'vault-active',
      type: 'info',
      icon: <Lock className="w-4 h-4 text-indigo-400" />,
      title: 'Encrypted Vault Secure',
      message: `${documents.length} document(s) safely stored under cryptographic family protection.`,
      badge: 'Security',
      border: 'border-slate-800 bg-slate-950',
    });
  }

  const activeFeedItems = feedItems.filter(item => !dismissedIds.includes(item.id));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-white uppercase">Intelligence &amp; Family Feed</h3>
        </div>
        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-300">
          Live Analysis
        </span>
      </div>

      <div className="space-y-3 pt-1">
        {activeFeedItems.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 font-mono">
            No active intelligence alerts or all items have been dismissed.
          </div>
        ) : (
          activeFeedItems.map((item) => (
            <div key={item.id} className={`border rounded-xl p-4 flex items-start justify-between gap-3.5 transition-all ${item.border}`}>
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl shrink-0 mt-0.5 shadow-inner">
                  {item.icon}
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-white text-xs truncate">{item.title}</h4>
                    <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 shrink-0">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{item.message}</p>
                </div>
              </div>
              <button onClick={() => handleDismiss(item.id)} className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SecureDocumentsVault({ documents = [] }: { documents: any[] }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
        <Lock className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-bold text-white uppercase">Encrypted Family Vault &amp; Documents</h3>
      </div>
      <p className="text-xs text-slate-400">
        Securely stored legal wills, trust deeds, property deeds, and financial statements protected with AES-256 encryption.
      </p>

      {documents.length === 0 ? (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 text-center space-y-2">
          <div className="text-slate-300 font-bold text-sm">No documents uploaded to vault yet</div>
          <p className="text-xs text-slate-500">Upload statements or legal documents via the AI Reader or household settings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-indigo-600/10 border border-indigo-500/20 rounded-lg text-indigo-400 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-white text-xs truncate">{doc.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {doc.fileType || 'PDF'} {doc.fileSize ? `• ${doc.fileSize}` : ''} • {new Date(doc.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-lg text-xs font-semibold shrink-0 transition-colors border border-slate-700">
                View
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LiabilitiesManagementSection({ assets, baseCurrency, liveRates, onAddLiability }: { assets: any[]; baseCurrency: string; liveRates: { [key: string]: number }; onAddLiability: () => void }) {
  const liabilities = assets.filter(a => {
    const type = (a.assetType || '').toUpperCase();
    const cat = (a.accountCategory || '').toUpperCase();
    return type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY' || cat === 'DEBT';
  });

  const getBaseVal = (asset: any) => {
    const val = parseFloat(asset.nativeValue || '0');
    const curr = asset.nativeCurrency || 'USD';
    return convertCurrency(val, curr, baseCurrency, liveRates);
  };

  const totalLiabilities = liabilities.reduce((s: number, a: any) => s + getBaseVal(a), 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-rose-400" />
          <h3 className="text-sm font-bold text-white uppercase">Liabilities &amp; Debt Tracking</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-rose-400 font-bold">Total Debt: -{Math.round(totalLiabilities).toLocaleString()} {baseCurrency}</span>
          <button onClick={onAddLiability} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-lg cursor-pointer">
            + Add Liability
          </button>
        </div>
      </div>

      {liabilities.length === 0 ? (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 text-center space-y-3">
          <div className="text-slate-300 font-bold text-sm">No active liabilities logged yet</div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Log mortgages, cross-border loans, or credit lines using the button above to automatically subtract from your net worth in {baseCurrency}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {liabilities.map((item) => (
            <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex justify-between items-center">
              <div>
                <div className="font-bold text-white text-sm">{item.name}</div>
                <div className="text-xs text-slate-400">Owner: {item.user?.fullName || 'Family Member'} | Category: {item.accountCategory}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-rose-400 font-bold">-{Math.round(getBaseVal(item)).toLocaleString()} {item.nativeCurrency || baseCurrency}</span>
                <button onClick={async () => { await deleteAssetAction(item.id); }} className="text-slate-400 hover:text-rose-400 p-1 cursor-pointer">
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

function CurrencySwitcherForm({ currentCurrency }: { currentCurrency: string }) {
  const router = useRouter();
  const [selectedCurrency, setSelectedCurrency] = useState(currentCurrency);
  const [isPending, startTransition] = useTransition();

  useEffect(() => { setSelectedCurrency(currentCurrency); }, [currentCurrency]);

  const handleCurrencyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCurrency = e.target.value;
    setSelectedCurrency(newCurrency);
    startTransition(async () => {
      await updateHouseholdBaseCurrencyAction(newCurrency);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-xl shrink-0 shadow-sm">
      <Coins className="w-3.5 h-3.5 text-indigo-400" />
      <select 
        value={selectedCurrency} 
        onChange={handleCurrencyChange} 
        disabled={isPending}
        className="bg-transparent border-0 text-xs text-indigo-300 font-mono font-bold focus:outline-none cursor-pointer disabled:opacity-50"
      >
        {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'CHF', 'CNY'].map((c) => (
          <option key={c} value={c} className="bg-slate-900 text-white">{c}</option>
        ))}
      </select>
    </div>
  );
}

function FutureMilestonesAndDirectives({ assets }: { assets: any[] }) {
  const ssnAssets = assets.filter(a => a.accountCategory === 'SOCIAL_SECURITY');
  const pensionAssets = assets.filter(a => a.accountCategory === 'PENSION' || a.assetType === 'PENSION');
  const ppfAssets = assets.filter(a => a.accountCategory === 'PPF');
  const [customData, setCustomData] = useState<{ [key: string]: { amount: number; instruction: string; editing: boolean } }>({});

  if (ssnAssets.length === 0 && pensionAssets.length === 0 && ppfAssets.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Shield className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-white uppercase">Future Income Milestones &amp; Family Directives</h3>
        </div>
        <div className="text-center py-8 text-xs text-slate-500">
          No pension, provident fund, or social security assets logged yet. Add them to view milestones.
        </div>
      </div>
    );
  }

  const getDefaultInstruction = (category: string) => {
    if (category === 'SOCIAL_SECURITY') return 'Sovereign monthly pension stream tracked separately. Excluded from liquid net worth.';
    if (category === 'PENSION') return 'Guaranteed monthly pension tier claimable upon reaching maturity.';
    return 'Family Claiming Instruction: Submit forms at the designated branch upon maturity.';
  };

  const getAmount = (asset: any) => customData[asset.id]?.amount !== undefined ? customData[asset.id].amount : parseFloat(asset.nativeValue || '0');
  const getInstruction = (asset: any) => customData[asset.id]?.instruction !== undefined ? customData[asset.id].instruction : getDefaultInstruction(asset.accountCategory);
  const isEditing = (assetId: string) => customData[assetId]?.editing || false;

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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-white uppercase">Future Income Milestones &amp; Family Directives</h3>
        </div>
      </div>
      <div className="space-y-3">
        {ssnAssets.concat(pensionAssets, ppfAssets).map((asset) => {
          const cur = asset.nativeCurrency || 'USD';
          return (
            <div key={asset.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="w-full md:w-3/4">
                <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{asset.name || 'Income Stream'}</div>
                <div className="text-sm font-semibold text-white mt-1">
                  Owner: <span className="text-indigo-300 font-medium">{asset.user?.fullName || 'Family Member'}</span>
                </div>
                {isEditing(asset.id) ? (
                  <textarea
                    value={getInstruction(asset)}
                    onChange={(e) => updateField(asset.id, 'instruction', e.target.value)}
                    className="w-full mt-2 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none resize-none"
                    rows={2}
                  />
                ) : (
                  <div className="text-xs text-slate-400 mt-0.5 max-w-xl">{getInstruction(asset)}</div>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-left md:text-right">
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Target Value / Payout</span>
                  {isEditing(asset.id) ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="number"
                        value={getAmount(asset)}
                        onChange={(e) => updateField(asset.id, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-24 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-emerald-400 font-bold focus:outline-none"
                      />
                      <span className="text-xs text-slate-400">{cur}</span>
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-emerald-400 font-bold">{getAmount(asset).toLocaleString()} {cur}</span>
                  )}
                </div>
                <button onClick={() => setEditing(asset.id, !isEditing(asset.id))} className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl cursor-pointer">
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
      <p className="text-xs text-slate-400">Write overarching login protocols, broker contact details, and succession steps for entire accounts.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="space-y-2">
          <label className="block text-[10px] text-slate-400 uppercase font-medium">Select Account / Institution</label>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {uniqueAccounts.map((acct) => (
              <button
                key={acct}
                onClick={() => { setSelectedAccount(acct); setEditingNote(instructionsMap[acct] || ''); }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-mono transition-colors cursor-pointer border ${selectedAccount === acct ? 'bg-indigo-600/20 border-indigo-500/50 text-white font-bold' : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'}`}
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
                  onClick={() => { setInstructionsMap(prev => ({ ...prev, [selectedAccount]: editingNote })); alert('Account instructions saved!'); }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg cursor-pointer shadow-md transition-colors"
                >
                  Save Account Notes
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-slate-500 py-8">Select an account from the left to view or edit master family instructions.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function NetWorthTrendChart({ trendData = [], baseCurrency, timeRange, setTimeRange }: { trendData: { month: string; value: number }[]; baseCurrency: string; timeRange: string; setTimeRange: (val: string) => void }) {
  const rawData = Array.isArray(trendData) ? trendData.filter(d => d && d.value > 0) : [];
  const getOptimizedData = (data: any[]) => {
    if (data.length <= 12) return data;
    const step = Math.ceil(data.length / 10);
    return data.filter((item, idx) => idx % step === 0 || idx === data.length - 1);
  };
  const safeData = getOptimizedData(rawData);
  const formatCompactValue = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
    return val.toString();
  };
  const width = 700; const height = 180; const padding = 40;
  const values = safeData.map(d => d.value);
  const minVal = values.length > 0 ? Math.min(...values) * 0.95 : 0;
  const maxVal = values.length > 0 ? Math.max(...values) * 1.05 : 1;
  const range = maxVal - minVal || 1;
  const points = safeData.map((d, idx) => {
    const x = safeData.length === 1 ? width / 2 : padding + (idx / (safeData.length - 1)) * (width - padding * 2);
    const y = height - padding - ((d.value - minVal) / range) * (height - padding * 2);
    return { x, y, ...d };
  });
  const pathString = points.reduce((acc, pt, idx) => idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`, '');
  const areaString = points.length > 0 ? `${pathString} L ${points[points.length - 1].x} ${height - 10} L ${points[0].x} ${height - 10} Z` : '';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-white uppercase">Historical Net Worth Trend</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase text-slate-400 font-medium">Timeline:</span>
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-indigo-300 font-mono font-bold focus:outline-none cursor-pointer">
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
      <div className="pt-4 pb-2 px-1 border-b border-slate-800/80">
        {safeData.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-xs text-slate-500 font-mono">Loading timeline data...</div>
        ) : (
          <div className="relative w-full overflow-hidden rounded-xl">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-52 overflow-visible">
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d={areaString} fill="url(#areaGradient)" />
              <path d={pathString} fill="none" stroke="#818cf8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((pt, idx) => (
                <g key={idx} className="group cursor-pointer">
                  <circle cx={pt.x} cy={pt.y} r="5" className="fill-slate-900 stroke-indigo-400 stroke-2 transition-all group-hover:scale-150 group-hover:stroke-emerald-400" />
                  <text x={pt.x} y={pt.y - 12} textAnchor="middle" className="text-[10px] font-mono fill-slate-300 group-hover:fill-emerald-400 font-semibold transition-colors">{formatCompactValue(pt.value)}</text>
                  <text x={pt.x} y={height - 5} textAnchor="middle" className="text-[9px] font-mono fill-slate-400">{pt.month}</text>
                  <title>{`${pt.month}: ${pt.value.toLocaleString()} ${baseCurrency}`}</title>
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

function AssetAllocationVisualizer({ assets, baseCurrency, totalNetWorth, liveRates }: { assets: any[]; baseCurrency: string; totalNetWorth: number; liveRates: { [key: string]: number } }) {
  const typeMap: { [key: string]: number } = {};
  assets.forEach((a) => {
    let t = (a.assetType || 'OTHER').toUpperCase().trim();
    if (t === 'LIABILITY' || t === 'DEBT') return;
    if (t === 'EQUITY') t = 'EQUITIES';
    const val = convertCurrency(parseFloat(a.nativeValue || '0'), a.nativeCurrency || 'USD', baseCurrency, liveRates);
    typeMap[t] = (typeMap[t] || 0) + val;
  });
  const sortedEntries = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);
  const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-cyan-500', 'bg-rose-500'];
  const positiveNetWorth = Math.max(totalNetWorth, 1);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
        <PieChart className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-bold text-white uppercase">Asset Class Allocation</h3>
      </div>
      {sortedEntries.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-xs">No assets available for allocation view.</div>
      ) : (
        <div className="space-y-4">
          <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
            {sortedEntries.map(([type, val], idx) => {
              const pct = (val / positiveNetWorth) * 100;
              return <div key={type} style={{ width: `${Math.max(pct, 2)}%` }} className={`${colors[idx % colors.length]} transition-all duration-500`} title={`${type}: ${pct.toFixed(1)}%`} />;
            })}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
            {sortedEntries.map(([type, val], idx) => {
              const pct = positiveNetWorth > 0 ? ((val / positiveNetWorth) * 100).toFixed(1) : '0';
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

function AddAssetModal({ legacyPillars, members, onClose, isLiability }: { legacyPillars: { name: string; description: string }[]; members: any[]; onClose: () => void; isLiability: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm overflow-y-auto flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl my-auto">
        <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-800">
          <h2 className="text-base font-bold text-white">{isLiability ? 'Add Liability / Debt' : 'Add Asset Manually'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <form action={async (fd) => {
          if (isLiability) { fd.set('assetType', 'LIABILITY'); fd.set('accountCategory', 'LIABILITY'); }
          await addAssetAction(fd);
          onClose();
        }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] text-slate-400 mb-1">{isLiability ? 'Liability Name' : 'Asset Name'}</label><input name="name" required placeholder={isLiability ? 'e.g. Mortgage' : 'e.g. Apple Stock'} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white" /></div>
            <div><label className="block text-[10px] text-slate-400 mb-1">Ticker / Reference</label><input name="ticker" placeholder="Optional" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono" /></div>
          </div>
          {!isLiability && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Asset Type</label>
                <select name="assetType" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white">
                  <option value="STOCK">Stock</option>
                  <option value="CRYPTO">Crypto</option>
                  <option value="COMMODITY">Commodity / Gold</option>
                  <option value="CASH">Cash</option>
                  <option value="FIXED_INCOME">Fixed Income / PPF</option>
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
          )}
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-[10px] text-slate-400 mb-1">Quantity</label><input name="quantity" type="number" step="any" defaultValue="1" required className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono" /></div>
            <div><label className="block text-[10px] text-slate-400 mb-1">{isLiability ? 'Debt Amount' : 'Total Value'}</label><input name="nativeValue" type="number" step="any" required placeholder="10000" className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono" /></div>
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
          {!isLiability && (
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Strategic Rationale &amp; Legacy Pillar</label>
              <select name="rationale" defaultValue={legacyPillars[0]?.name} required className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white cursor-pointer">
                {legacyPillars.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs cursor-pointer">Cancel</button>
            <button type="submit" className={`px-4 py-2 text-white rounded-lg text-xs font-semibold cursor-pointer ${isLiability ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
              {isLiability ? 'Save Liability' : 'Save Asset'}
            </button>
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
    } catch (err) { console.error(err); }
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
    } catch (err: any) { setError(err.message || 'An unexpected error occurred.'); }
    finally { setUploading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm overflow-y-auto flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-5xl shadow-2xl max-h-[90vh] overflow-y-auto my-auto relative">
        {uploading && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-30 rounded-2xl flex flex-col items-center justify-center gap-3 text-center p-6">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-white font-bold text-sm">Processing Statement with Gemini AI...</div>
            <div className="text-slate-400 text-xs max-w-sm">Reading document tables, extracting tickers, and calculating asset values.</div>
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
              <input name="files" type="file" multiple accept=".pdf,image/*" className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white cursor-pointer" />
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-2">
                <ClipboardPaste className="w-3.5 h-3.5 text-indigo-400" />
                <span>Or Paste Statement Text / Holdings</span>
              </label>
              <textarea name="pastedText" rows={3} placeholder="Paste account holdings, table rows, or statement text here..." className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none" />
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t border-slate-900">
            <button type="submit" disabled={uploading} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl cursor-pointer disabled:opacity-50 shadow-md transition-colors flex items-center gap-2">
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
                <select value={bulkUser} onChange={(e) => setBulkUser(e.target.value)} className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white cursor-pointer font-medium">
                  {members.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
                </select>
                <button onClick={async () => { setUploading(true); try { await approveAllDraftLineItemsAction(bulkUser); await loadData(); setSuccessMsg("Successfully approved all pending items!"); } catch { setError("Failed to approve items."); } finally { setUploading(false); } }} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg cursor-pointer shadow-md">
                  <CheckCheck className="w-4 h-4" /><span>Approve All Pending</span>
                </button>
              </div>
            )}
          </div>
          {drafts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">No pending items. Upload statements or paste text above!</div>
          ) : (
            <div className="space-y-3">
              {drafts.map((item) => <DraftItemRow key={item.id} item={item} members={members} legacyPillars={legacyPillars} onRefresh={loadData} />)}
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

function WealthSummaryDashboard({ assets, baseCurrency, legacyPillars, liveRates }: { assets: any[]; baseCurrency: string; legacyPillars: { name: string; description: string }[]; liveRates: { [key: string]: number } }) {
  const [expM, setExpM] = useState<{ [key: string]: boolean }>({});
  const [expP, setExpP] = useState<{ [key: string]: boolean }>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const getBaseVal = (valStr: string, curr: string) => convertCurrency(parseFloat(valStr || '0'), curr || 'USD', baseCurrency, liveRates);

  // Helper to group identical tickers/assets per family member
  const groupMemberAssets = (rawAssets: any[]) => {
    const map: { [key: string]: any } = {};
    rawAssets.forEach(a => {
      const key = a.ticker ? a.ticker.toUpperCase().trim() : a.name.toLowerCase().trim();
      if (!map[key]) {
        map[key] = {
          ...a,
          totalNative: parseFloat(a.nativeValue || '0'),
          totalQty: parseFloat(a.quantity || '1'),
          accounts: [a.accountCategory],
          ids: [a.id]
        };
      } else {
        map[key].totalNative += parseFloat(a.nativeValue || '0');
        map[key].totalQty += parseFloat(a.quantity || '1');
        if (!map[key].accounts.includes(a.accountCategory)) {
          map[key].accounts.push(a.accountCategory);
        }
        map[key].ids.push(a.id);
      }
    });
    return Object.values(map);
  };

  const memberMap: { [key: string]: { total: number; assets: any[] } } = {};
  assets.forEach((a) => {
    const type = (a.assetType || '').toUpperCase();
    const cat = (a.accountCategory || '').toUpperCase();
    if (type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY' || cat === 'DEBT') return;
    const name = a.user?.fullName || 'Family General';
    if (!memberMap[name]) memberMap[name] = { total: 0, assets: [] };
    memberMap[name].total += getBaseVal(a.nativeValue, a.nativeCurrency);
    memberMap[name].assets.push(a);
  });

  Object.keys(memberMap).forEach(name => {
    // Group identical tickers/assets for this member
    memberMap[name].assets = groupMemberAssets(memberMap[name].assets);
    memberMap[name].assets.sort((a, b) => getBaseVal(b.totalNative, b.nativeCurrency) - getBaseVal(a.totalNative, a.nativeCurrency));
  });
  const sortedMembers = Object.entries(memberMap).sort((a, b) => b[1].total - a[1].total);

  const purposeMap: { [key: string]: { total: number; assets: any[] } } = {};
  assets.forEach((a) => {
    const type = (a.assetType || '').toUpperCase();
    const cat = (a.accountCategory || '').toUpperCase();
    if (type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY' || cat === 'DEBT') return;
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800"><Users className="w-5 h-5 text-indigo-400" /><h3 className="text-sm font-bold text-white uppercase">Family Member Sub-Totals</h3></div>
        <div className="space-y-3">
          {sortedMembers.map(([name, data]) => (
            <div key={name} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden min-w-0">
              <button onClick={() => setExpM(p => ({ ...p, [name]: !p[name] }))} className="w-full p-4 flex justify-between items-center text-left hover:bg-slate-900/50 cursor-pointer min-w-0">
                <div className="min-w-0 pr-2"><div className="font-bold text-white text-sm truncate">{name}</div><div className="text-xs text-slate-400">{data.assets.length} consolidated holding(s)</div></div>
                <div className="flex items-center gap-3 shrink-0"><span className="font-mono text-emerald-400 font-semibold">{Math.round(data.total).toLocaleString()} {baseCurrency}</span>{expM[name] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}</div>
              </button>
              {expM[name] && (
                <div className="border-t border-slate-900 p-4 space-y-2 bg-slate-950/80">
                  {data.assets.map((asset) => (
                    <div key={asset.id} className="bg-slate-900/70 border border-slate-800 p-3 rounded-lg text-xs flex justify-between items-center min-w-0">
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
                          <div className="min-w-0 pr-2">
                            <span className="font-bold text-white truncate block">
                              {asset.name} {asset.ticker ? `(${asset.ticker})` : ''}
                            </span>
                            <span className="text-[10px] text-indigo-300">
                              Accounts: {asset.accounts.join(', ')} {asset.totalQty > 1 ? `• Total Qty: ${asset.totalQty}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-emerald-400 font-semibold">{Math.round(getBaseVal(asset.totalNative, asset.nativeCurrency)).toLocaleString()} {baseCurrency}</span>
                            <button onClick={() => setEditingId(asset.id)} className="text-slate-400 hover:text-indigo-400"><Edit3 className="w-3.5 h-3.5" /></button>
                            <button onClick={async () => { await deleteAssetAction(asset.id); }} className="text-slate-400 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
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
              <div key={purposeName} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden min-w-0">
                <button onClick={() => setExpP(p => ({ ...p, [purposeName]: !p[purposeName] }))} className="w-full p-4 flex justify-between items-center text-left hover:bg-slate-900/50 cursor-pointer min-w-0">
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-white text-sm flex items-center gap-2 truncate">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span><span className="truncate">{purposeName}</span>
                    </div>
                    <div className="text-xs text-slate-400">{data.assets.length} account(s)</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
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
                      <div key={a.id} className="flex justify-between items-center bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 min-w-0">
                        <span className="font-bold text-white truncate pr-2">{a.name}</span>
                        <span className="font-mono text-emerald-400 font-semibold shrink-0">{Math.round(getBaseVal(a.nativeValue, a.nativeCurrency)).toLocaleString()} {baseCurrency}</span>
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
  );
}

function LegalInfoModal({ type, onClose }: { type: 'privacy' | 'terms' | 'faq' | 'about'; onClose: () => void }) {
  const titles = { about: 'About OmniWealth', faq: 'Frequently Asked Questions (FAQ)', privacy: 'Privacy Policy', terms: 'Terms of Service' };
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[85vh] overflow-y-auto my-auto text-slate-200 text-xs space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <h2 className="text-base font-bold text-white">{titles[type]}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        {type === 'about' && (
          <div className="space-y-3 leading-relaxed text-slate-300">
            <p><strong>OmniWealth</strong> is a next-generation Global Family Wealth Command Center designed to help multi-generational households unify cross-border assets, track live foreign exchange rates, and manage generational legacy directives in one secure place.</p>
          </div>
        )}
        {type === 'faq' && (
          <div className="space-y-4 text-slate-300">
            <div><div className="font-bold text-white mb-1">Q: How are live currency exchange rates updated?</div><p className="text-slate-400">A: OmniWealth fetches real-time fiat exchange rates via Frankfurt API and crypto prices via CoinGecko.</p></div>
            <div><div className="font-bold text-white mb-1">Q: Is my document vault secure?</div><p className="text-slate-400">A: Yes, all uploaded files and sensitive statements are encrypted at rest using AES-256 encryption.</p></div>
          </div>
        )}
        {type === 'privacy' && (<div className="space-y-3 text-slate-300"><p>Your privacy is paramount. OmniWealth stores your data in encrypted database columns and secure cryptographic vaults.</p></div>)}
        {type === 'terms' && (<div className="space-y-3 text-slate-300"><p>By accessing and using OmniWealth, you agree to use the platform solely for personal family wealth tracking.</p></div>)}
        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer">Close</button>
        </div>
      </div>
    </div>
  );
}