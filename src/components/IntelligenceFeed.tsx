'use client';

import { useState } from 'react';
import { Sparkles, TrendingUp, Lock, Calendar, Coins, X } from 'lucide-react';

interface IntelligenceFeedProps {
  assets: any[];
  trendData: { month: string; value: number }[];
  baseCurrency: string;
  documents: any[];
}

export default function IntelligenceFeed({ assets, trendData, baseCurrency, documents }: IntelligenceFeedProps) {
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
      icon: <TrendingUp className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />,
      title: 'Portfolio Growth',
      message: `Your household net worth grew by +${growthPercent.toFixed(1)}% (${Math.round(growthAmount).toLocaleString()} ${baseCurrency}) this month. Keep up the momentum!`,
      badge: 'Performance',
      border: 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20',
    });
  }

  milestoneAssets.forEach((asset) => {
    feedItems.push({
      id: `milestone-${asset.id}`,
      type: 'milestone',
      icon: <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
      title: asset.name,
      message: `Owner: ${asset.user?.fullName || 'Family Member'}. Logged value stands at ${parseFloat(asset.nativeValue || '0').toLocaleString()} ${asset.nativeCurrency || baseCurrency}. Ensure succession directives are updated.`,
      badge: 'Milestone',
      border: 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
    });
  });

  if (documents.length === 0) {
    feedItems.push({
      id: 'vault-empty',
      type: 'warning',
      icon: <Lock className="w-4 h-4 text-amber-700 dark:text-amber-400" />,
      title: 'Secure Vault Empty',
      message: 'You have not uploaded any wills, trust deeds, or physical statements to your AES-256 encrypted vault yet.',
      badge: 'Action Required',
      border: 'border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20',
    });
  } else {
    feedItems.push({
      id: 'vault-active',
      type: 'info',
      icon: <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
      title: 'Encrypted Vault Secure',
      message: `${documents.length} document(s) safely stored under cryptographic family protection.`,
      badge: 'Security',
      border: 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
    });
  }

  feedItems.push({
    id: 'tax-notice',
    type: 'notice',
    icon: <Coins className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />,
    title: 'Multi-Currency Base Alignment',
    message: `All asset evaluations are dynamically normalized to your active base currency (${baseCurrency}) using live FX conversion engines.`,
    badge: 'System Notice',
    border: 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
  });

  const activeFeedItems = feedItems.filter(item => !dismissedIds.includes(item.id));

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Intelligence &amp; Family Feed</h3>
        </div>
        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
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
            <div key={item.id} className={`border rounded-xl p-4 flex items-start justify-between gap-3.5 transition-all shadow-sm ${item.border}`}>
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shrink-0 mt-0.5 shadow-sm">
                  {item.icon}
                </div>
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-snug">{item.title}</h4>
                    <span className="self-start sm:self-auto text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{item.message}</p>
                </div>
              </div>
              <button
                onClick={() => handleDismiss(item.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                title="Dismiss Card"
                aria-label="Dismiss Card"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}