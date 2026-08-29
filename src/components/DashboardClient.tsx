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

// ========================================================= //
// SHARED VALUATION HOOK                                     //
// ========================================================= //
function useAssetValuation(assets: any[], baseCurrency: string, liveRates: { [key: string]: number }) {
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

  const totalNetWorth = assets.reduce((s: number, a: any) => s + getBaseVal(a), 0);
  
  const liquidAssets = assets.filter(a => {
    const type = (a.assetType || '').toUpperCase();
    const category = (a.accountCategory || '').toUpperCase();
    return type !== 'REAL_ESTATE' && category !== 'SOCIAL_SECURITY' && type !== 'LIABILITY' && type !== 'DEBT';
  });
  const totalLiquidWealth = liquidAssets.reduce((s: number, a: any) => s + getBaseVal(a), 0);

  return { getBaseVal, totalNetWorth, totalLiquidWealth };
}

// Helper to group identical tickers/assets across accounts
function groupAssets(rawAssets: any[]) {
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

  const { totalNetWorth, totalLiquidWealth } = useAssetValuation(initialAssets, baseCurrency, liveRates);

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
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-20 flex flex-col justify-between selection:bg-teal-600 selection:text-white font-sans">
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
        {/* MOBILE AI STATEMENT READER PROMOTIONAL BANNER             */}
        {/* ========================================================= */}
        {activeTab === 'wealth' && (
          <div className="block md:hidden px-4 pt-4">
            <button 
              onClick={() => setIsAiReaderOpen(true)}
              className="w-full bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between text-left cursor-pointer group hover:bg-slate-800 transition"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-800 rounded-xl text-amber-400 border border-slate-700 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-white flex items-center gap-1.5">
                    AI Statement Reader <span className="bg-amber-500/20 text-amber-300 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-amber-500/30">NEW</span>
                  </div>
                  <div className="text-xs text-slate-400 truncate">Upload PDF statements or paste holdings instantly</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* MOBILE SLIDE-OUT NAVIGATION DRAWER                        */}
        {/* ========================================================= */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div 
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity" 
              onClick={() => setIsMobileMenuOpen(false)} 
            />

            <div className="relative w-4/5 max-w-xs bg-white text-slate-900 h-full shadow-2xl z-10 flex flex-col justify-between p-6 border-r border-slate-200 overflow-y-auto">
              <div className="space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className="relative w-7 h-7 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                      <Image src="/omniwealth.jpg" alt="OmniWealth" width={28} height={28} className="object-cover w-full h-full" />
                    </div>
                    <span className="font-bold text-sm tracking-wide text-slate-950">OmniWealth Office</span>
                  </div>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => { setActiveTab('wealth'); setIsAddAssetOpen(true); setIsMobileMenuOpen(false); }}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition"
                  >
                    <Plus className="w-3.5 h-3.5" /><span>Add Asset</span>
                  </button>
                  <button 
                    onClick={() => { setActiveTab('liabilities'); setIsAddLiabilityOpen(true); setIsMobileMenuOpen(false); }}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition"
                  >
                    <CreditCard className="w-3.5 h-3.5" /><span>Liability</span>
                  </button>
                </div>

                <nav className="flex flex-col space-y-1.5 pt-2">
                  <button 
                    onClick={() => { setActiveTab('wealth'); setIsMobileMenuOpen(false); }} 
                    className={`flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${activeTab === 'wealth' ? 'bg-teal-700 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-700'}`}
                  >
                    <Home className="w-4 h-4" />
                    <span>Portfolio Overview</span>
                  </button>

                  <button 
                    onClick={() => { setIsAiReaderOpen(true); setIsMobileMenuOpen(false); }} 
                    className="flex items-center justify-between py-3 px-3.5 rounded-xl text-sm font-semibold cursor-pointer hover:bg-slate-100 text-slate-700 transition-colors"
                  >
                    <div className="flex items-center space-x-3.5">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>AI Statement Reader</span>
                    </div>
                    <span className="bg-amber-100 text-amber-900 text-[9px] font-extrabold px-1.5 py-0.5 rounded">NEW</span>
                  </button>

                  <button 
                    onClick={() => { setActiveTab('liabilities'); setIsMobileMenuOpen(false); }} 
                    className={`flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${activeTab === 'liabilities' ? 'bg-teal-700 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-700'}`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Liabilities &amp; Debt</span>
                  </button>

                  <button 
                    onClick={() => { setActiveTab('retirement'); setIsMobileMenuOpen(false); }} 
                    className={`flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${activeTab === 'retirement' ? 'bg-teal-700 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-700'}`}
                  >
                    <Target className="w-4 h-4" />
                    <span>Retirement &amp; Planning</span>
                  </button>

                  <button 
                    onClick={() => { setActiveTab('directives'); setIsMobileMenuOpen(false); }} 
                    className={`flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${activeTab === 'directives' ? 'bg-teal-700 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-700'}`}
                  >
                    <Shield className="w-4 h-4" />
                    <span>Directives &amp; Vault</span>
                  </button>

                  <button 
                    onClick={() => { setActiveTab('feed'); setIsMobileMenuOpen(false); }} 
                    className={`flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${activeTab === 'feed' ? 'bg-teal-700 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-700'}`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span>Intelligence Feed</span>
                  </button>
                </nav>
              </div>

              <div className="pt-4 border-t border-slate-200 space-y-2.5">
                <Link href="/profile" onClick={() => setIsMobileMenuOpen(false)} className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition">
                  <span className="flex items-center gap-2"><Settings className="w-4 h-4 text-slate-500" /> Household Settings</span>
                </Link>
                {session.user.role === 'SUPER_ADMIN' && (
                  <Link href="/admin" onClick={() => setIsMobileMenuOpen(false)} className="w-full flex items-center justify-between px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 text-sm font-semibold rounded-xl border border-amber-200 transition">
                    <span className="flex items-center gap-2"><Shield className="w-4 h-4 text-amber-600" /> Admin Portal</span>
                  </Link>
                )}
                <form action={logoutAction} className="pt-1">
                  <button type="submit" className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-rose-50 text-rose-700 text-sm font-semibold rounded-xl border border-rose-200 hover:bg-rose-100 cursor-pointer transition">
                    <LogOut className="w-4 h-4" /> Logout
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
          <div className="hidden md:flex bg-white border border-slate-200/80 p-1.5 rounded-2xl items-center gap-2 overflow-x-auto shadow-sm">
            <button onClick={() => setActiveTab('wealth')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer shrink-0 ${activeTab === 'wealth' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
              <Wallet className="w-4 h-4" /> Wealth &amp; Assets
            </button>
            <button onClick={() => setActiveTab('liabilities')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer shrink-0 ${activeTab === 'liabilities' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
              <CreditCard className="w-4 h-4" /> Liabilities &amp; Debt
            </button>
            <button onClick={() => setActiveTab('retirement')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer shrink-0 ${activeTab === 'retirement' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
              <Target className="w-4 h-4" /> Retirement &amp; Planning
            </button>
            <button onClick={() => setActiveTab('directives')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer shrink-0 ${activeTab === 'directives' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
              <Shield className="w-4 h-4" /> Directives &amp; Vault
            </button>
            <button onClick={() => setActiveTab('feed')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer shrink-0 ${activeTab === 'feed' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
              <Sparkles className="w-4 h-4" /> Intelligence Feed
            </button>
          </div>

          <div className="space-y-6">
            {activeTab === 'wealth' && (
              <div className="space-y-6 animate-fadeIn">
                <WealthSummaryDashboard assets={initialAssets} baseCurrency={baseCurrency} legacyPillars={legacyPillars} liveRates={liveRates} />
                <AssetAllocationVisualizer assets={initialAssets} baseCurrency={baseCurrency} liveRates={liveRates} />
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

      <footer className="max-w-7xl mx-auto w-full px-4 md:px-8 mt-20 pt-8 border-t border-slate-200 text-slate-500 text-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-center md:text-left space-y-1">
          <div>&copy; 2026 OmniWealth Private Office. All rights reserved.</div>
          <div className="text-xs text-slate-500 max-w-xl">
            Disclaimer: OmniWealth is a global multi-generational family asset command platform for informational tracking purposes only.
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 font-medium text-slate-600">
          <button onClick={() => setActiveModal('about')} className="hover:text-slate-900 transition-colors cursor-pointer">About</button>
          <span>•</span>
          <button onClick={() => setActiveModal('faq')} className="hover:text-slate-900 transition-colors cursor-pointer">FAQ</button>
          <span>•</span>
          <button onClick={() => setActiveModal('privacy')} className="hover:text-slate-900 transition-colors cursor-pointer">Privacy Policy</button>
          <span>•</span>
          <button onClick={() => setActiveModal('terms')} className="hover:text-slate-900 transition-colors cursor-pointer">Terms of Service</button>
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
function UnifiedHeaderAndSummary({ session, initialAssets, baseCurrency, liveRates, onOpenMenu, onOpenAddAsset, onOpenLiability, onOpenAiReader }: any) {
  const router = useRouter();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const { getBaseVal, totalNetWorth } = useAssetValuation(initialAssets, baseCurrency, liveRates);

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

  const householdTitle = session?.household?.name ? session.household.name.replace(/ Vault$/i, '') : 'Private Vault';

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
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 px-4 md:px-8 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button 
              onClick={onOpenMenu} 
              className="md:hidden p-2 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl cursor-pointer hover:bg-slate-200 transition"
              aria-label="Open Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link href="/" className="flex items-center gap-2.5 group cursor-pointer min-w-0">
              <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-slate-100 flex items-center justify-center shadow-sm">
                <Image src="/omniwealth.jpg" alt="OmniWealth" width={32} height={32} className="object-cover w-full h-full" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-slate-900 text-sm md:text-base tracking-tight truncate">
                  {householdTitle} <span className="font-normal text-xs text-slate-500 hidden md:inline">Command</span>
                </div>
                <div className="text-[11px] uppercase tracking-wider text-teal-700 font-semibold font-mono">Family Office Suite</div>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <CurrencySwitcherForm currentCurrency={baseCurrency} />
            
            <div className="hidden md:flex items-center gap-2">
              <button onClick={onOpenAddAsset} className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm rounded-xl transition cursor-pointer shadow-sm">
                <Plus className="w-4 h-4" /><span>Add Asset</span>
              </button>
              <button onClick={onOpenLiability} className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white font-semibold text-sm rounded-xl transition cursor-pointer shadow-sm">
                <CreditCard className="w-4 h-4" /><span>Add Liability</span>
              </button>
              {/* Premium Dark Slate AI Reader Button matching peer action weight */}
              <button onClick={onOpenAiReader} className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 font-semibold text-sm rounded-xl transition cursor-pointer shadow-sm">
                <Sparkles className="w-4 h-4 text-amber-400" /><span>AI Reader</span>
              </button>

              <button 
                onClick={handleRefreshPrices} 
                disabled={isRefreshing}
                title="Refresh Live Market Prices & Exchange Rates" 
                className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition cursor-pointer disabled:opacity-50 shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>

              <div className="h-5 w-[1px] bg-slate-200 mx-1" />

              <Link href="/profile" title="Household Settings" className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition cursor-pointer shadow-sm">
                <Settings className="w-4 h-4" />
              </Link>

              {session.user.role === 'SUPER_ADMIN' && (
                <Link href="/admin" title="Admin Portal" className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl border border-amber-200 transition cursor-pointer shadow-sm">
                  <Shield className="w-4 h-4" />
                </Link>
              )}

              <form action={logoutAction}>
                <button type="submit" title="Logout" className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl border border-rose-200 transition cursor-pointer shadow-sm">
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE COMPACT SUMMARY BAR */}
      <div className="block md:hidden px-4 pt-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold block">Global Net Worth</span>
            <div className="text-xl font-black font-mono text-teal-700 truncate">
              {Math.round(totalNetWorth).toLocaleString()} <span className="text-xs font-sans font-normal text-teal-600">{baseCurrency}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={handleRefreshPrices} 
              disabled={isRefreshing}
              title="Refresh Live Market Prices" 
              className="p-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 cursor-pointer disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Persistent Summary Bar with Uniform Clean Cards */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 md:px-8 pt-2">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex justify-between items-center">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-slate-400" /> Global Household Net Worth
            </span>
            <div className="text-4xl font-extrabold font-mono text-teal-700 mt-1">
              {Math.round(totalNetWorth).toLocaleString()} <span className="text-teal-600 text-lg font-sans">{baseCurrency}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {sortedCategories.map(([cat, val]) => (
              <div key={cat} className="bg-slate-50/70 border border-slate-200/80 px-4 py-3 rounded-xl text-xs shadow-sm">
                <span className="text-slate-500 uppercase text-[10px] block font-medium">{cat}</span>
                <span className={`font-mono font-bold text-sm ${val < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
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
      icon: <TrendingUp className="w-4 h-4 text-emerald-700" />,
      title: 'Portfolio Progress Update',
      message: `Great job! Your household net worth grew by +${growthPercent.toFixed(1)}% (${Math.round(growthAmount).toLocaleString()} ${baseCurrency}) this month.`,
      badge: 'Performance',
      border: 'border-emerald-200 bg-emerald-50/50',
    });
  }

  milestoneAssets.forEach((asset) => {
    feedItems.push({
      id: `milestone-${asset.id}`,
      type: 'milestone',
      icon: <Calendar className="w-4 h-4 text-slate-500" />,
      title: `Future Income Stream: ${asset.name}`,
      message: `Owner: ${asset.user?.fullName || 'Family Member'}. Logged value stands at ${parseFloat(asset.nativeValue || '0').toLocaleString()} ${asset.nativeCurrency || baseCurrency}.`,
      badge: 'Milestone',
      border: 'border-slate-200 bg-white',
    });
  });

  if (documents.length === 0) {
    feedItems.push({
      id: 'vault-empty',
      type: 'warning',
      icon: <Lock className="w-4 h-4 text-amber-700" />,
      title: 'Secure Document Vault Empty',
      message: 'You have not uploaded any wills, trust deeds, or physical statements to your AES-256 encrypted vault yet.',
      badge: 'Action Required',
      border: 'border-amber-200 bg-amber-50/50',
    });
  } else {
    feedItems.push({
      id: 'vault-active',
      type: 'info',
      icon: <Lock className="w-4 h-4 text-slate-500" />,
      title: 'Encrypted Vault Secure',
      message: `${documents.length} document(s) safely stored under cryptographic family protection.`,
      badge: 'Security',
      border: 'border-slate-200 bg-white',
    });
  }

  const activeFeedItems = feedItems.filter(item => !dismissedIds.includes(item.id));

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-900 uppercase">Intelligence &amp; Family Feed</h3>
        </div>
        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600">
          Live Analysis
        </span>
      </div>

      <div className="space-y-3 pt-1">
        {activeFeedItems.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-500 font-mono">
            No active intelligence alerts or all items have been dismissed.
          </div>
        ) : (
          activeFeedItems.map((item) => (
            <div key={item.id} className={`border rounded-xl p-4 flex items-start justify-between gap-3.5 transition-all shadow-sm ${item.border}`}>
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl shrink-0 mt-0.5 shadow-sm">
                  {item.icon}
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-slate-900 text-sm truncate">{item.title}</h4>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.message}</p>
                </div>
              </div>
              <button onClick={() => handleDismiss(item.id)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
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
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
        <Lock className="w-5 h-5 text-slate-500" />
        <h3 className="text-sm font-bold text-slate-900 uppercase">Encrypted Family Vault &amp; Documents</h3>
      </div>
      <p className="text-sm text-slate-600">
        Securely stored legal wills, trust deeds, property deeds, and financial statements protected with AES-256 encryption.
      </p>

      {documents.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center space-y-2">
          <div className="text-slate-800 font-bold text-sm">No documents uploaded to vault yet</div>
          <p className="text-xs text-slate-500">Upload statements or legal documents via the AI Reader or household settings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-600 shrink-0 shadow-sm">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 text-sm truncate">{doc.name}</div>
                  <div className="text-xs text-slate-500 font-mono">
                    {doc.fileType || 'PDF'} {doc.fileSize ? `• ${doc.fileSize}` : ''} • {new Date(doc.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold shrink-0 transition-colors border border-slate-200 shadow-sm">
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
  const { getBaseVal } = useAssetValuation(assets, baseCurrency, liveRates);
  
  const liabilities = assets.filter(a => {
    const type = (a.assetType || '').toUpperCase();
    const cat = (a.accountCategory || '').toUpperCase();
    return type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY' || cat === 'DEBT';
  });

  const totalLiabilities = liabilities.reduce((s: number, a: any) => s + Math.abs(getBaseVal(a)), 0);

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-rose-700" />
          <h3 className="text-sm font-bold text-slate-900 uppercase">Liabilities &amp; Debt Tracking</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-rose-700 font-bold">Total Debt: -{Math.round(totalLiabilities).toLocaleString()} {baseCurrency}</span>
          <button onClick={onAddLiability} className="px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs rounded-lg cursor-pointer shadow-sm transition">
            + Add Liability
          </button>
        </div>
      </div>

      {liabilities.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center space-y-3">
          <div className="text-slate-800 font-bold text-sm">No active liabilities logged yet</div>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Log mortgages, cross-border loans, or credit lines using the button above to automatically subtract from your net worth in {baseCurrency}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {liabilities.map((item) => (
            <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center shadow-sm">
              <div>
                <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                <div className="text-xs text-slate-500">Owner: {item.user?.fullName || 'Family Member'} | Category: {item.accountCategory}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-rose-700 font-bold text-sm">-{Math.round(Math.abs(getBaseVal(item))).toLocaleString()} {item.nativeCurrency || baseCurrency}</span>
                <button onClick={async () => { await deleteAssetAction(item.id); }} className="text-slate-400 hover:text-rose-700 p-1.5 cursor-pointer">
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
    <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl shrink-0 shadow-sm">
      <Coins className="w-4 h-4 text-slate-500" />
      <select 
        value={selectedCurrency} 
        onChange={handleCurrencyChange} 
        disabled={isPending}
        className="bg-transparent border-0 text-xs text-slate-800 font-mono font-bold focus:outline-none cursor-pointer disabled:opacity-50"
      >
        {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'CHF', 'CNY'].map((c) => (
          <option key={c} value={c} className="bg-white text-slate-900">{c}</option>
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
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
          <Shield className="w-5 h-5 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-900 uppercase">Future Income Milestones &amp; Family Directives</h3>
        </div>
        <div className="text-center py-8 text-sm text-slate-500">
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
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-900 uppercase">Future Income Milestones &amp; Family Directives</h3>
        </div>
      </div>
      <div className="space-y-3">
        {ssnAssets.concat(pensionAssets, ppfAssets).map((asset) => {
          const cur = asset.nativeCurrency || 'USD';
          return (
            <div key={asset.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
              <div className="w-full md:w-3/4">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">{asset.name || 'Income Stream'}</div>
                <div className="text-sm font-semibold text-slate-900 mt-1">
                  Owner: <span className="text-slate-700 font-medium">{asset.user?.fullName || 'Family Member'}</span>
                </div>
                {isEditing(asset.id) ? (
                  <textarea
                    value={getInstruction(asset)}
                    onChange={(e) => updateField(asset.id, 'instruction', e.target.value)}
                    className="w-full mt-2 bg-white border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none resize-none shadow-sm"
                    rows={2}
                  />
                ) : (
                  <div className="text-xs text-slate-500 mt-1 max-w-xl">{getInstruction(asset)}</div>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-left md:text-right shadow-sm">
                  <span className="text-[10px] text-slate-400 uppercase block font-medium">Target Value / Payout</span>
                  {isEditing(asset.id) ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="number"
                        value={getAmount(asset)}
                        onChange={(e) => updateField(asset.id, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-24 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono text-slate-900 font-bold focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">{cur}</span>
                    </div>
                  ) : (
                    <span className="text-sm font-mono text-slate-900 font-bold">{getAmount(asset).toLocaleString()} {cur}</span>
                  )}
                </div>
                <button onClick={() => setEditing(asset.id, !isEditing(asset.id))} className="p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 rounded-xl cursor-pointer shadow-sm transition">
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
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
        <Shield className="w-5 h-5 text-slate-500" />
        <h3 className="text-sm font-bold text-slate-900 uppercase">Institution &amp; Account-Level Family Directives</h3>
      </div>
      <p className="text-sm text-slate-600">Write overarching login protocols, broker contact details, and succession steps for entire accounts.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="space-y-2">
          <label className="block text-[10px] text-slate-400 uppercase font-medium">Select Account / Institution</label>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {uniqueAccounts.map((acct) => (
              <button
                key={acct}
                onClick={() => { setSelectedAccount(acct); setEditingNote(instructionsMap[acct] || ''); }}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-mono transition-colors cursor-pointer border ${selectedAccount === acct ? 'bg-slate-100 border-slate-300 text-slate-900 font-bold shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
              >
                {acct}
              </button>
            ))}
          </div>
        </div>
        <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3 shadow-sm">
          {selectedAccount ? (
            <>
              <div>
                <div className="text-xs font-bold text-slate-800 mb-1">Directives for: {selectedAccount}</div>
                <textarea
                  value={editingNote}
                  onChange={(e) => setEditingNote(e.target.value)}
                  placeholder="Enter succession notes, broker estate desk info, or multi-stock transfer instructions..."
                  rows={4}
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:border-slate-400 resize-none shadow-sm"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => { setInstructionsMap(prev => ({ ...prev, [selectedAccount]: editingNote })); alert('Account instructions saved!'); }}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-lg cursor-pointer shadow-sm transition-colors"
                >
                  Save Account Notes
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-slate-400 py-8">Select an account from the left to view or edit master family instructions.</div>
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
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-900 uppercase">Historical Net Worth Trend</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase text-slate-500 font-medium">Timeline:</span>
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-mono font-bold focus:outline-none cursor-pointer shadow-sm">
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
      <div className="pt-4 pb-2 px-1 border-b border-slate-100">
        {safeData.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-xs text-slate-400 font-mono">Loading timeline data...</div>
        ) : (
          <div className="relative w-full overflow-hidden rounded-xl">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-52 overflow-visible">
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d={areaString} fill="url(#areaGradient)" />
              <path d={pathString} fill="none" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((pt, idx) => (
                <g key={idx} className="group cursor-pointer">
                  <circle cx={pt.x} cy={pt.y} r="5" className="fill-white stroke-teal-700 stroke-2 transition-all group-hover:scale-150 group-hover:stroke-emerald-600" />
                  <text x={pt.x} y={pt.y - 12} textAnchor="middle" className="text-[10px] font-mono fill-slate-700 group-hover:fill-emerald-600 font-semibold transition-colors">{formatCompactValue(pt.value)}</text>
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

function AssetAllocationVisualizer({ assets, baseCurrency, liveRates }: { assets: any[]; baseCurrency: string; liveRates: { [key: string]: number } }) {
  const { totalNetWorth } = useAssetValuation(assets, baseCurrency, liveRates);
  const typeMap: { [key: string]: number } = {};
  
  assets.forEach((a) => {
    let t = (a.assetType || 'OTHER').toUpperCase().trim();
    if (t === 'LIABILITY' || t === 'DEBT') return;
    if (t === 'EQUITY') t = 'EQUITIES';
    const val = convertCurrency(parseFloat(a.nativeValue || '0'), a.nativeCurrency || 'USD', baseCurrency, liveRates);
    typeMap[t] = (typeMap[t] || 0) + val;
  });
  
  const sortedEntries = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);
  const colors = ['bg-slate-800', 'bg-teal-700', 'bg-slate-600', 'bg-slate-500', 'bg-teal-900', 'bg-slate-400'];
  const positiveNetWorth = Math.max(totalNetWorth, 1);

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
        <PieChart className="w-5 h-5 text-slate-500" />
        <h3 className="text-sm font-bold text-slate-900 uppercase">Asset Class Allocation</h3>
      </div>
      {sortedEntries.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-sm">No assets available for allocation view.</div>
      ) : (
        <div className="space-y-4">
          <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
            {sortedEntries.map(([type, val], idx) => {
              const pct = (val / positiveNetWorth) * 100;
              return <div key={type} style={{ width: `${Math.max(pct, 2)}%` }} className={`${colors[idx % colors.length]} transition-all duration-500`} title={`${type}: ${pct.toFixed(1)}%`} />;
            })}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
            {sortedEntries.map(([type, val], idx) => {
              const pct = positiveNetWorth > 0 ? ((val / positiveNetWorth) * 100).toFixed(1) : '0';
              return (
                <div key={type} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col gap-1.5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${colors[idx % colors.length]}`} />
                    <span className="text-xs font-bold text-slate-800 uppercase truncate">{type}</span>
                  </div>
                  <div className="font-mono text-sm text-slate-900 font-semibold">{Math.round(val).toLocaleString()} {baseCurrency}</div>
                  <div className="text-xs text-slate-500 font-mono">{pct}% of portfolio</div>
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
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs overflow-y-auto flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg shadow-xl my-auto text-slate-900">
        <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">{isLiability ? 'Add Liability / Debt' : 'Add Asset Manually'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <form action={async (fd) => {
          if (isLiability) { fd.set('assetType', 'LIABILITY'); fd.set('accountCategory', 'LIABILITY'); }
          await addAssetAction(fd);
          onClose();
        }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-slate-600 mb-1">{isLiability ? 'Liability Name' : 'Asset Name'}</label><input name="name" required placeholder={isLiability ? 'e.g. Mortgage' : 'e.g. Apple Stock'} className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2.5 text-sm text-slate-900 shadow-sm" /></div>
            <div><label className="block text-xs text-slate-600 mb-1">Ticker / Reference</label><input name="ticker" placeholder="Optional" className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2.5 text-sm text-slate-900 font-mono shadow-sm" /></div>
          </div>
          {!isLiability && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Asset Type</label>
                <select name="assetType" className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2.5 text-sm text-slate-900 shadow-sm">
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
                <label className="block text-xs text-slate-600 mb-1">Account Category</label>
                <select name="accountCategory" className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2.5 text-sm text-slate-900 shadow-sm">
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
            <div><label className="block text-xs text-slate-600 mb-1">Quantity</label><input name="quantity" type="number" step="any" defaultValue="1" required className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2.5 text-sm text-slate-900 font-mono shadow-sm" /></div>
            <div><label className="block text-xs text-slate-600 mb-1">{isLiability ? 'Debt Amount' : 'Total Value'}</label><input name="nativeValue" type="number" step="any" required placeholder="10000" className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2.5 text-sm text-slate-900 font-mono shadow-sm" /></div>
            <div><label className="block text-xs text-slate-600 mb-1">Currency</label><input name="nativeCurrency" defaultValue="USD" required className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2.5 text-sm text-slate-900 font-mono shadow-sm" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-slate-600 mb-1">Acct # (Last 4)</label><input name="accountNumber" defaultValue="DEFAULT" className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2.5 text-sm text-slate-900 font-mono shadow-sm" /></div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Owner</label>
              <select name="userId" className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2.5 text-sm text-slate-900 shadow-sm">
                {members.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
              </select>
            </div>
          </div>
          {!isLiability && (
            <div>
              <label className="block text-xs text-slate-600 mb-1">Strategic Rationale &amp; Legacy Pillar</label>
              <select name="rationale" defaultValue={legacyPillars[0]?.name} required className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2.5 text-sm text-slate-900 cursor-pointer shadow-sm">
                {legacyPillars.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm cursor-pointer hover:bg-slate-200 transition">Cancel</button>
            <button type="submit" className={`px-4 py-2 text-white rounded-lg text-sm font-semibold cursor-pointer shadow-sm transition ${isLiability ? 'bg-rose-700 hover:bg-rose-800' : 'bg-teal-700 hover:bg-teal-800'}`}>
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
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs overflow-y-auto flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-5xl shadow-xl max-h-[90vh] overflow-y-auto my-auto relative text-slate-900">
        {uploading && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-xs z-30 rounded-2xl flex flex-col items-center justify-center gap-3 text-center p-6">
            <div className="w-10 h-10 border-4 border-teal-700 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-slate-900 font-bold text-sm">Processing Statement with Gemini AI...</div>
            <div className="text-slate-500 text-xs max-w-sm">Reading document tables, extracting tickers, and calculating asset values.</div>
          </div>
        )}
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-bold text-slate-900">AI Statement Intelligence &amp; Review Locker</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        {error && <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-lg mb-4">{error}</div>}
        {successMsg && <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-lg mb-4">{successMsg}</div>}
        <form onSubmit={handleUpload} className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 space-y-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 p-3.5 rounded-xl flex flex-col justify-between shadow-sm">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-2">
                <FileUp className="w-4 h-4 text-slate-500" />
                <span>Upload PDF or Image Statements</span>
              </label>
              <input name="files" type="file" multiple accept=".pdf,image/*" className="w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-700 file:text-white cursor-pointer" />
            </div>
            <div className="bg-white border border-slate-200 p-3.5 rounded-xl flex flex-col justify-between shadow-sm">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-2">
                <ClipboardPaste className="w-4 h-4 text-slate-500" />
                <span>Or Paste Statement Text / Holdings</span>
              </label>
              <textarea name="pastedText" rows={3} placeholder="Paste account holdings, table rows, or statement text here..." className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 resize-none shadow-sm" />
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t border-slate-200">
            <button type="submit" disabled={uploading} className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-xl cursor-pointer disabled:opacity-50 shadow-sm transition-colors flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{uploading ? 'Analyzing with Gemini...' : 'Extract & Parse with AI'}</span>
            </button>
          </div>
        </form>
        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 pb-2 border-b border-slate-200 gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Pending Extracted Items ({drafts.length})</h3>
            {drafts.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 uppercase font-medium">Assign Owner For All:</span>
                <select value={bulkUser} onChange={(e) => setBulkUser(e.target.value)} className="bg-white border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-900 cursor-pointer font-medium shadow-sm">
                  {members.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
                </select>
                <button onClick={async () => { setUploading(true); try { await approveAllDraftLineItemsAction(bulkUser); await loadData(); setSuccessMsg("Successfully approved all pending items!"); } catch { setError("Failed to approve items."); } finally { setUploading(false); } }} className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg cursor-pointer shadow-sm">
                  <CheckCheck className="w-4 h-4" /><span>Approve All Pending</span>
                </button>
              </div>
            )}
          </div>
          {drafts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl bg-slate-50">No pending items. Upload statements or paste text above!</div>
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
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
      <div className="flex justify-between items-center">
        <div>
          <span className="font-bold text-slate-900 text-sm">{item.assetName}</span> {item.ticker && <span className="text-xs font-mono text-slate-600">({item.ticker})</span>}
          <div className="text-xs font-mono text-slate-900 font-semibold">{parseFloat(item.totalNativeValue).toLocaleString()} {item.nativeCurrency}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => { await approveDraftLineItemAction(item.id, cat, usr, acct, rat); onRefresh(); }} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 text-white rounded text-xs cursor-pointer shadow-sm"><Check className="w-4 h-4" /> Approve</button>
          <button onClick={async () => { await rejectDraftLineItemAction(item.id); onRefresh(); }} className="p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 rounded cursor-pointer shadow-sm"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-xs">
        <select value={usr} onChange={(e) => setUsr(e.target.value)} className="bg-white border border-slate-200 rounded p-1.5 text-slate-900 shadow-sm">{members.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}</select>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="bg-white border border-slate-200 rounded p-1.5 text-slate-900 shadow-sm">
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
        <input value={acct} onChange={(e) => setAcct(e.target.value)} placeholder="Acct #" className="bg-white border border-slate-200 rounded p-1.5 text-slate-900 font-mono shadow-sm" />
        <select value={rat} onChange={(e) => setRat(e.target.value)} className="bg-white border border-slate-200 rounded p-1.5 text-slate-900 cursor-pointer shadow-sm">
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

  const { getBaseVal } = useAssetValuation(assets, baseCurrency, liveRates);

  const memberMap: { [key: string]: { total: number; assets: any[] } } = {};
  assets.forEach((a) => {
    const type = (a.assetType || '').toUpperCase();
    const cat = (a.accountCategory || '').toUpperCase();
    if (type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY' || cat === 'DEBT') return;
    const name = a.user?.fullName || 'Family General';
    if (!memberMap[name]) memberMap[name] = { total: 0, assets: [] };
    memberMap[name].total += getBaseVal(a);
    memberMap[name].assets.push(a);
  });

  Object.keys(memberMap).forEach(name => {
    memberMap[name].assets = groupAssets(memberMap[name].assets);
    memberMap[name].assets.sort((a, b) => getBaseVal(b) - getBaseVal(a));
  });
  const sortedMembers = Object.entries(memberMap).sort((a, b) => b[1].total - a[1].total);

  const purposeMap: { [key: string]: { total: number; assets: any[] } } = {};
  assets.forEach((a) => {
    const type = (a.assetType || '').toUpperCase();
    const cat = (a.accountCategory || '').toUpperCase();
    if (type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY' || cat === 'DEBT') return;
    const p = a.rationale || legacyPillars[0]?.name || 'General Long-Term Growth';
    if (!purposeMap[p]) purposeMap[p] = { total: 0, assets: [] };
    purposeMap[p].total += getBaseVal(a);
    purposeMap[p].assets.push(a);
  });

  Object.keys(purposeMap).forEach(p => {
    purposeMap[p].assets = groupAssets(purposeMap[p].assets);
    purposeMap[p].assets.sort((a, b) => getBaseVal(b) - getBaseVal(a));
  });
  const sortedPurposes = Object.entries(purposeMap).sort((a, b) => b[1].total - a[1].total);

  // Extensible curated pillar dot colors that cycle cleanly
  const pillarDotColors = ['bg-teal-600', 'bg-amber-600', 'bg-purple-600', 'bg-blue-600', 'bg-emerald-600', 'bg-indigo-600', 'bg-rose-600'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200"><Users className="w-5 h-5 text-slate-500" /><h3 className="text-sm font-bold text-slate-900 uppercase">Family Member Sub-Totals</h3></div>
        <div className="space-y-3">
          {sortedMembers.map(([name, data]) => (
            <div key={name} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden min-w-0 shadow-sm">
              <button onClick={() => setExpM(p => ({ ...p, [name]: !p[name] }))} className="w-full p-4 flex justify-between items-center text-left hover:bg-slate-100/70 cursor-pointer min-w-0 transition">
                <div className="min-w-0 pr-2"><div className="font-bold text-slate-900 text-sm truncate">{name}</div><div className="text-xs text-slate-500">{data.assets.length} consolidated holding(s)</div></div>
                <div className="flex items-center gap-3 shrink-0"><span className="font-mono text-slate-900 font-semibold text-sm">{Math.round(data.total).toLocaleString()} {baseCurrency}</span>{expM[name] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}</div>
              </button>
              {expM[name] && (
                <div className="border-t border-slate-200 p-4 space-y-2.5 bg-white">
                  {data.assets.map((asset) => {
                    const val = getBaseVal(asset);
                    return (
                      <div key={asset.id} className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-xs flex justify-between items-center min-w-0 shadow-sm">
                        {editingId === asset.id ? (
                          <form action={async (fd) => { await updateAssetAction(asset.id, fd); setEditingId(null); }} className="w-full space-y-2">
                            <input name="name" defaultValue={asset.name} className="w-full bg-white border border-slate-200 rounded p-2 text-slate-900 text-sm shadow-sm" />
                            <div className="grid grid-cols-2 gap-2">
                              <input name="nativeValue" type="number" step="any" defaultValue={asset.nativeValue} className="w-full bg-white border border-slate-200 rounded p-2 text-slate-900 text-sm font-mono shadow-sm" />
                              <select name="rationale" defaultValue={asset.rationale} className="w-full bg-white border border-slate-200 rounded p-2 text-slate-900 text-sm cursor-pointer shadow-sm">
                                {legacyPillars.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                              </select>
                            </div>
                            <div className="flex justify-end gap-1.5"><button type="button" onClick={() => setEditingId(null)} className="px-2 py-1 bg-slate-100 rounded text-slate-600 text-xs shadow-sm"><X className="w-3.5 h-3.5" /></button><button type="submit" className="px-2 py-1 bg-emerald-700 rounded text-white text-xs shadow-sm"><Check className="w-3.5 h-3.5" /></button></div>
                          </form>
                        ) : (
                          <>
                            <div className="min-w-0 pr-2">
                              <span className="font-bold text-slate-900 text-sm truncate block">
                                {asset.name} {asset.ticker ? `(${asset.ticker})` : ''}
                              </span>
                              <span className="text-xs text-slate-500">
                                Accounts: {asset.accounts.join(', ')} {asset.totalQty > 1 ? `• Total Qty: ${asset.totalQty}` : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <span className={`font-mono font-semibold text-sm ${val < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{Math.round(val).toLocaleString()} {baseCurrency}</span>
                              <button onClick={() => setEditingId(asset.id)} className="text-slate-400 hover:text-slate-700 p-1"><Edit3 className="w-4 h-4" /></button>
                              <button onClick={async () => { await deleteAssetAction(asset.id); }} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200"><Target className="w-5 h-5 text-slate-500" /><h3 className="text-sm font-bold text-slate-900 uppercase">Purpose &amp; Legacy Instructions</h3></div>
        <div className="space-y-3">
          {sortedPurposes.map(([purposeName, data], idx) => {
            const matchedPillar = legacyPillars.find(p => p.name === purposeName);
            const description = matchedPillar?.description;
            const dotColor = pillarDotColors[idx % pillarDotColors.length];
            return (
              <div key={purposeName} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden min-w-0 shadow-sm">
                <button onClick={() => setExpP(p => ({ ...p, [purposeName]: !p[purposeName] }))} className="w-full p-4 flex justify-between items-center text-left hover:bg-slate-100/70 cursor-pointer min-w-0 transition">
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-slate-900 text-sm flex items-center gap-2 truncate">
                      <span className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`}></span><span className="truncate">{purposeName}</span>
                    </div>
                    <div className="text-xs text-slate-500">{data.assets.length} consolidated holding(s)</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-slate-900 font-semibold text-sm">{Math.round(data.total).toLocaleString()} {baseCurrency}</span>
                    {expP[purposeName] ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </div>
                </button>
                {expP[purposeName] && (
                  <div className="border-t border-slate-200 p-4 space-y-3 bg-white text-xs">
                    {description && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-700 space-y-1 shadow-sm">
                        <div className="flex items-center gap-1.5 text-slate-600 font-bold mb-1">
                          <FileText className="w-4 h-4" />
                          <span className="uppercase text-xs">Legacy Directive:</span>
                        </div>
                        <p className="text-slate-800 text-sm font-medium">{description}</p>
                      </div>
                    )}
                    {data.assets.map(asset => {
                      const val = getBaseVal(asset);
                      return (
                        <div key={asset.id} className="flex justify-between items-center bg-slate-50 p-3.5 rounded-xl border border-slate-200 min-w-0 shadow-sm">
                          <div className="min-w-0 pr-2">
                            <span className="font-bold text-slate-900 text-sm truncate block">
                              {asset.name} {asset.ticker ? `(${asset.ticker})` : ''}
                            </span>
                            <span className="text-xs text-slate-500">
                              Accounts: {asset.accounts.join(', ')} {asset.totalQty > 1 ? `• Total Qty: ${asset.totalQty}` : ''}
                            </span>
                          </div>
                          <span className={`font-mono font-semibold text-sm shrink-0 ${val < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{Math.round(val).toLocaleString()} {baseCurrency}</span>
                        </div>
                      );
                    })}
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
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[85vh] overflow-y-auto my-auto text-slate-800 text-sm space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">{titles[type]}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        {type === 'about' && (
          <div className="space-y-3 leading-relaxed text-slate-600">
            <p><strong>OmniWealth</strong> is a next-generation Global Family Wealth Command Center designed to help multi-generational households unify cross-border assets, track live foreign exchange rates, and manage generational legacy directives in one secure place.</p>
          </div>
        )}
        {type === 'faq' && (
          <div className="space-y-4 text-slate-600">
            <div><div className="font-bold text-slate-900 mb-1">Q: How are live currency exchange rates updated?</div><p className="text-slate-500">A: OmniWealth fetches real-time fiat exchange rates via Frankfurt API and crypto prices via CoinGecko.</p></div>
            <div><div className="font-bold text-slate-900 mb-1">Q: Is my document vault secure?</div><p className="text-slate-500">A: Yes, all uploaded files and sensitive statements are encrypted at rest using AES-256 encryption.</p></div>
          </div>
        )}
        {type === 'privacy' && (<div className="space-y-3 text-slate-600"><p>Your privacy is paramount. OmniWealth stores your data in encrypted database columns and secure cryptographic vaults.</p></div>)}
        {type === 'terms' && (<div className="space-y-3 text-slate-600"><p>By accessing and using OmniWealth, you agree to use the platform solely for personal family wealth tracking.</p></div>)}
        <div className="flex justify-end pt-3 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm">Close</button>
        </div>
      </div>
    </div>
  );
}