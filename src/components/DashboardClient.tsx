'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

// Import modular dashboard sections
import UnifiedHeaderAndSummary from '@/components/dashboard/UnifiedHeaderAndSummary';
import WealthSummaryDashboard from '@/components/dashboard/WealthSummaryDashboard';
import AssetAllocationVisualizer from '@/components/dashboard/AssetAllocationVisualizer';
import NetWorthTrendChart from '@/components/dashboard/NetWorthTrendChart';
import LiabilitiesManagementSection from '@/components/dashboard/LiabilitiesManagementSection';
import IntelligenceFeed from '@/components/dashboard/IntelligenceFeed';
import ActivityLog from '@/components/dashboard/ActivityLog';
import ConcentrationAlert from '@/components/dashboard/ConcentrationAlert';
import CurrencyExposure from '@/components/dashboard/CurrencyExposure';
import StaleValueNudge from '@/components/dashboard/StaleValueNudge';
import EstateReadinessCard from '@/components/dashboard/EstateReadinessCard';
import FutureMilestonesAndDirectives from '@/components/dashboard/FutureMilestonesAndDirectives';
import AccountInstructionsHub from '@/components/dashboard/AccountInstructionsHub';
import SecureDocumentsVault from '@/components/dashboard/SecureDocumentsVault';
import EditAssetModal from '@/components/dashboard/EditAssetModal';

// Import Modals & External Components
import AddAssetModal from '@/components/dashboard/AddAssetModal';
import StatementUploadModal from '@/components/dashboard/StatementUploadModal';
import RetirementCalculator from '@/components/RetirementCalculator';
import Footer from '@/components/Footer';
import VaultUploadModal from '@/components/VaultUploadModal';
import SessionMenuButton from '@/components/SessionMenuButton';

import {
  fetchFamilyMembersAction,
  fetchNetWorthTrendAction,
  fetchNetWorthSnapshotsAction,
  updateThemePreferenceAction
} from '@/actions/vault';
import {
  Home, Plus, Sparkles, X, CreditCard, Settings, Shield, Wallet, Target, TrendingUp, Sun, Moon, Menu
} from 'lucide-react';
import { canWrite, canManageHousehold } from '@/lib/permissions';

const FX_RATES: { [key: string]: number } = {
  USD: 1, EUR: 1.08, GBP: 1.28, CAD: 0.74, AUD: 0.65, INR: 0.012, JPY: 0.0067, CHF: 1.12, CNY: 0.149,
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
  const role = session?.user?.role;
  const canAdd = canWrite(role);
  const canManage = canManageHousehold(role);

  const [activeTab, setActiveTab] = useState<'wealth' | 'liabilities' | 'retirement' | 'directives' | 'feed'>('wealth');
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [isAddLiabilityOpen, setIsAddLiabilityOpen] = useState(false);
  const [isAiReaderOpen, setIsAiReaderOpen] = useState(false);
  const [isVaultUploadOpen, setIsVaultUploadOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<{ month: string; value: number }[]>([]);
  const [trendEstimated, setTrendEstimated] = useState(true);
  const [timeRange, setTimeRange] = useState('6m');
  const [liveRates, setLiveRates] = useState<{ [key: string]: number }>(initialLiveRates);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Edit Asset / Liability Modal State
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);
  }, []);

  const toggleTheme = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    const themeString = newMode ? 'dark' : 'light';

    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }

    try {
      await updateThemePreferenceAction(themeString as 'light' | 'dark');
    } catch (err) {
      console.error('Failed to sync theme preference to database:', err);
    }
  };

  useEffect(() => {
    fetchFamilyMembersAction().then(setMembers).catch(err => console.warn('Failed to fetch family members:', err));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const rangeDays: Record<string, number> = {
      '1m': 31, '3m': 93, '6m': 186, '1y': 372, '3y': 1116,
      '5y': 1860, '10y': 3720, '15y': 5580, '20y': 7440,
    };
    Promise.all([
      fetchNetWorthSnapshotsAction().catch(() => [] as { date: string; value: number }[]),
      fetchNetWorthTrendAction(timeRange).catch(() => [] as { month: string; value: number }[]),
    ]).then(([snapshots, estimated]) => {
      if (cancelled) return;
      // Prefer real recorded history once we have at least two points.
      if (Array.isArray(snapshots) && snapshots.length >= 2) {
        const days = rangeDays[timeRange] ?? 186;
        const cutoff = Date.now() - days * 86400_000;
        const windowed = snapshots.filter((s) => new Date(s.date).getTime() >= cutoff);
        const use = windowed.length >= 2 ? windowed : snapshots;
        const longRange = days > 400;
        setTrendData(
          use.map((s) => {
            const d = new Date(s.date);
            return {
              month: longRange
                ? d.toLocaleString('default', { month: 'short', year: '2-digit' })
                : d.toLocaleString('default', { month: 'short', day: 'numeric' }),
              value: s.value,
            };
          }),
        );
        setTrendEstimated(false);
      } else {
        setTrendData(Array.isArray(estimated) ? estimated : []);
        setTrendEstimated(true);
      }
    });
    return () => { cancelled = true; };
  }, [timeRange]);

  useEffect(() => {
    const handleUrlOpen = async (data: { url: string }) => {
      if (data.url && data.url.startsWith('com.omniwealth.app')) {
        try { await Browser.close(); } catch (e) { console.warn('Browser already closed', e); }
      }
    };
    App.addListener('appUrlOpen', handleUrlOpen);
    return () => { App.removeAllListeners(); };
  }, []);

  const legacyPillars = useMemo(() => {
    try {
      const parsed = JSON.parse(session?.household?.legacyPillars || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (err) {
      console.warn('Failed to parse legacy pillars:', err);
    }
    return [
      { name: 'Core Growth & Accumulation', description: '' },
      { name: 'Retirement & Income Preservation', description: '' },
      { name: 'Succession & Education', description: '' },
      { name: 'General Long-Term Growth', description: '' },
    ];
  }, [session?.household?.legacyPillars]);

  // Compute total liquid wealth correctly converted to baseCurrency for retirement calculator
  const totalLiquidWealth = useMemo(() => {
    return initialAssets.reduce((s, a) => {
      const type = (a.assetType || '').toUpperCase();
      const cat = (a.accountCategory || '').toUpperCase();
      if (type === 'REAL_ESTATE' || cat === 'SOCIAL_SECURITY' || type === 'LIABILITY' || type === 'DEBT') return s;
      
      const val = parseFloat(a.nativeValue || '0');
      const baseVal = convertCurrency(val, a.nativeCurrency || 'USD', baseCurrency, liveRates);
      return s + Math.abs(baseVal);
    }, 0);
  }, [initialAssets, baseCurrency, liveRates]);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 flex flex-col justify-between selection:bg-teal-600 selection:text-white font-sans transition-colors print:bg-white print:text-slate-900 print:pb-0">
      <div>
        <UnifiedHeaderAndSummary
          session={session}
          initialAssets={initialAssets}
          baseCurrency={baseCurrency}
          liveRates={liveRates}
          canAdd={canAdd}
          onOpenMenu={() => setIsMobileMenuOpen(true)}
          onOpenAddAsset={() => setIsAddAssetOpen(true)}
          onOpenLiability={() => setIsAddLiabilityOpen(true)}
          onOpenAiReader={() => setIsAiReaderOpen(true)}
        />
        
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden print:hidden">
            <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="relative w-4/5 max-w-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white h-full shadow-2xl z-10 flex flex-col justify-between p-6 border-r border-slate-200 dark:border-slate-800 overflow-y-auto">
              <div className="space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-sm">
                      <Image src="/omniwealth.jpg" alt="OmniWealth" width={32} height={32} className="object-cover w-full h-full" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white text-xs tracking-tight truncate">
                        Family Wealth Hub
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-teal-700 dark:text-teal-400 font-semibold font-mono truncate">
                        {session?.household?.name || 'Private Family'}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer shrink-0">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 px-1 pt-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="truncate">{session?.user?.fullName}</span>
                  <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                    {session?.user?.role}
                  </span>
                </div>

                <nav className="flex flex-col space-y-1.5 pt-2">
                  <button onClick={() => { setActiveTab('wealth'); setIsMobileMenuOpen(false); }} className={`flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${activeTab === 'wealth' ? 'bg-teal-700 text-white shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                    <Home className="w-4 h-4" /><span>Portfolio Overview</span>
                  </button>

                  {/* Add Asset & AI Statement Reader Actions */}
                  {canAdd && (
                    <>
                      <button onClick={() => { setIsAddAssetOpen(true); setIsMobileMenuOpen(false); }} className="flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-sm font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors">
                        <Plus className="w-4 h-4 text-teal-600 dark:text-teal-400" /><span>Add Asset</span>
                      </button>
                      <button onClick={() => { setIsAiReaderOpen(true); setIsMobileMenuOpen(false); }} className="flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-sm font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors">
                        <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" /><span>AI Statement Reader</span>
                      </button>
                    </>
                  )}

                  <button onClick={() => { setActiveTab('liabilities'); setIsMobileMenuOpen(false); }} className={`flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${activeTab === 'liabilities' ? 'bg-teal-700 text-white shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                    <CreditCard className="w-4 h-4" /><span>Liabilities &amp; Debt</span>
                  </button>
                  <button onClick={() => { setActiveTab('retirement'); setIsMobileMenuOpen(false); }} className={`flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${activeTab === 'retirement' ? 'bg-teal-700 text-white shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                    <Target className="w-4 h-4" /><span>Retirement &amp; Planning</span>
                  </button>
                  <button onClick={() => { setActiveTab('directives'); setIsMobileMenuOpen(false); }} className={`flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${activeTab === 'directives' ? 'bg-teal-700 text-white shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                    <Shield className="w-4 h-4" /><span>Directives &amp; Vault</span>
                  </button>
                  <button onClick={() => { setActiveTab('feed'); setIsMobileMenuOpen(false); }} className={`flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${activeTab === 'feed' ? 'bg-teal-700 text-white shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                    <TrendingUp className="w-4 h-4" /><span>Intelligence Feed</span>
                  </button>

                  {/* Theme Switcher inside Mobile Drawer */}
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between py-3 px-3.5 rounded-xl text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center space-x-3.5">
                      {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
                      <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
                    </span>
                  </button>

                  {session?.user?.role === 'SUPER_ADMIN' && (
                    <Link href="/admin" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-sm font-semibold hover:bg-purple-50 dark:hover:bg-purple-950/40 text-purple-700 dark:text-purple-300 transition-colors">
                      <Shield className="w-4 h-4" /><span>Super Admin Portal</span>
                    </Link>
                  )}

                  <Link href="/profile" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center space-x-3.5 py-3 px-3.5 rounded-xl text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors">
                    <Settings className="w-4 h-4" /><span>Household Settings</span>
                  </Link>
                </nav>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <SessionMenuButton />
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 space-y-6">
          {/* Navigation Tabs */}
          <div className="hidden md:flex bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-1.5 rounded-2xl items-center gap-2 overflow-x-auto shadow-sm print:hidden">
            <button onClick={() => setActiveTab('wealth')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer shrink-0 ${activeTab === 'wealth' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <Wallet className="w-4 h-4" /> Wealth &amp; Assets
            </button>
            <button onClick={() => setActiveTab('liabilities')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer shrink-0 ${activeTab === 'liabilities' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <CreditCard className="w-4 h-4" /> Liabilities &amp; Debt
            </button>
            <button onClick={() => setActiveTab('retirement')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer shrink-0 ${activeTab === 'retirement' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <Target className="w-4 h-4" /> Retirement &amp; Planning
            </button>
            <button onClick={() => setActiveTab('directives')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer shrink-0 ${activeTab === 'directives' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <Shield className="w-4 h-4" /> Directives &amp; Vault
            </button>
            <button onClick={() => setActiveTab('feed')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer shrink-0 ${activeTab === 'feed' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <Sparkles className="w-4 h-4" /> Intelligence Feed
            </button>
          </div>

          <div className="space-y-6">
            {activeTab === 'wealth' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="hidden print:block space-y-2 mb-6">
                  <div className="border-b-2 border-slate-900 pb-3">
                    <h1 className="text-xl font-bold uppercase tracking-wide text-slate-900">OmniWealth Executive Family Office Report</h1>
                    <p className="text-xs text-slate-600 font-mono mt-0.5">Generated on {new Date().toLocaleDateString()} • Confidential Asset &amp; Estate Summary</p>
                  </div>
                </div>

                <ConcentrationAlert assets={initialAssets} baseCurrency={baseCurrency} liveRates={liveRates} />
                <StaleValueNudge assets={initialAssets} />
                <WealthSummaryDashboard
                  assets={initialAssets}
                  baseCurrency={baseCurrency}
                  legacyPillars={legacyPillars}
                  liveRates={liveRates}
                  onEditAsset={canManage ? (asset: any) => {
                    setEditingAsset(asset);
                    setIsEditModalOpen(true);
                  } : undefined}
                />
                <AssetAllocationVisualizer assets={initialAssets} baseCurrency={baseCurrency} liveRates={liveRates} />
                <CurrencyExposure assets={initialAssets} baseCurrency={baseCurrency} liveRates={liveRates} />
                <NetWorthTrendChart trendData={trendData} baseCurrency={baseCurrency} timeRange={timeRange} setTimeRange={setTimeRange} estimated={trendEstimated} />
              </div>
            )}

            {activeTab === 'liabilities' && (
              <div className="space-y-6 animate-fadeIn print:hidden">
                <LiabilitiesManagementSection
                  assets={initialAssets}
                  baseCurrency={baseCurrency}
                  liveRates={liveRates}
                  canAdd={canAdd}
                  canManage={canManage}
                  onAddLiability={() => setIsAddLiabilityOpen(true)}
                  onEditAsset={canManage ? (asset: any) => {
                    setEditingAsset(asset);
                    setIsEditModalOpen(true);
                  } : undefined}
                />
              </div>
            )}

            {activeTab === 'retirement' && (
              <div className="space-y-6 animate-fadeIn print:hidden">
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
              <div className="space-y-6 animate-fadeIn print:hidden">
                <FutureMilestonesAndDirectives assets={initialAssets} />
                <EstateReadinessCard assets={initialAssets} />
                <AccountInstructionsHub assets={initialAssets} />
                <SecureDocumentsVault documents={initialDocuments} onOpenUpload={() => setIsVaultUploadOpen(true)} />
              </div>
            )}

            {activeTab === 'feed' && (
              <div className="space-y-6 animate-fadeIn print:hidden">
                <IntelligenceFeed assets={initialAssets} trendData={trendData} baseCurrency={baseCurrency} documents={initialDocuments} />
                <ActivityLog />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="print:hidden"><Footer /></div>

      {isAddAssetOpen && <AddAssetModal legacyPillars={legacyPillars} members={members} onClose={() => setIsAddAssetOpen(false)} isLiability={false} />}
      {isAddLiabilityOpen && <AddAssetModal legacyPillars={legacyPillars} members={members} onClose={() => setIsAddLiabilityOpen(false)} isLiability={true} />}
      {isAiReaderOpen && <StatementUploadModal legacyPillars={legacyPillars} members={members} onClose={() => setIsAiReaderOpen(false)} />}
      {isVaultUploadOpen && <VaultUploadModal isOpen={isVaultUploadOpen} onClose={() => setIsVaultUploadOpen(false)} />}
      
      {/* Universal Edit Asset/Liability Modal */}
      <EditAssetModal 
        asset={editingAsset}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingAsset(null);
        }}
        legacyPillars={legacyPillars}
      />
    </main>
  );
}