'use client';

import { Sparkles, TrendingUp, ShieldAlert, Lock, Calendar, Coins } from 'lucide-react';

interface IntelligenceFeedProps {
  assets: any[];
  trendData: { month: string; value: number }[];
  baseCurrency: string;
  documents: any[];
}

export default function IntelligenceFeed({ assets, trendData, baseCurrency, documents }: IntelligenceFeedProps) {
  // 1. Calculate Monthly Growth Progress
  const safeData = Array.isArray(trendData) ? trendData : [];
  const currentVal = safeData[safeData.length - 1]?.value || 0;
  const previousVal = safeData[safeData.length - 2]?.value || currentVal;
  const growthAmount = currentVal - previousVal;
  const growthPercent = previousVal > 0 ? (growthAmount / previousVal) * 100 : 0;

  // 2. Identify Future Milestones (Pensions / Social Security)
  const milestoneAssets = assets.filter(a => ['SOCIAL_SECURITY', 'PENSION', 'PPF'].includes(a.accountCategory));

  // 3. Generate Dynamic Feed Items
  const feedItems = [];

  // Performance Celebration Card
  if (growthPercent > 0) {
    feedItems.push({
      id: 'perf-growth',
      type: 'success',
      icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
      title: 'Portfolio Progress Update',
      message: `Great job! Your household net worth grew by +${growthPercent.toFixed(1)}% (${Math.round(growthAmount).toLocaleString()} ${baseCurrency}) this month. Keep up the momentum!`,
      badge: 'Performance',
      border: 'border-emerald-500/30 bg-emerald-950/20',
    });
  }

  // Milestone Reminders
  milestoneAssets.forEach((asset) => {
    feedItems.push({
      id: `milestone-${asset.id}`,
      type: 'milestone',
      icon: <Calendar className="w-4 h-4 text-indigo-400" />,
      title: `Future Income Stream: ${asset.name}`,
      message: `Owner: ${asset.user?.fullName || 'Family Member'}. Logged value stands at ${parseFloat(asset.nativeValue || '0').toLocaleString()} ${asset.nativeCurrency || baseCurrency}. Ensure succession directives are updated.`,
      badge: 'Milestone',
      border: 'border-indigo-500/30 bg-indigo-950/20',
    });
  });

  // Vault Status Check
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

  // General Cross-Border Tax/Compliance Info Card
  feedItems.push({
    id: 'tax-notice',
    type: 'notice',
    icon: <Coins className="w-4 h-4 text-cyan-400" />,
    title: 'Multi-Currency Base Alignment',
    message: `All asset evaluations are dynamically normalized to your active base currency (${baseCurrency}) using live FX conversion engines.`,
    badge: 'System Notice',
    border: 'border-slate-800 bg-slate-950',
  });

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
        {feedItems.map((item) => (
          <div key={item.id} className={`border rounded-xl p-4 flex items-start gap-3.5 transition-all ${item.border}`}>
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
        ))}
      </div>
    </div>
  );
}