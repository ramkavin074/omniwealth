'use client';

import { useMemo } from 'react';
import { Globe } from 'lucide-react';

export default function NetWorthTrendChart({ trendData = [], baseCurrency, timeRange, setTimeRange }: any) {
  const rawData = Array.isArray(trendData) ? trendData.filter(d => d && d.value > 0) : [];
  const formatCompactValue = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
    return val.toString();
  };

  const { desktopChart } = useMemo(() => {
    const generateChartData = (maxPoints: number, width: number, height: number, padding: number) => {
      const data = rawData.length <= maxPoints ? rawData : rawData.filter((_, idx) => idx % Math.ceil(rawData.length / (maxPoints - 1)) === 0 || idx === rawData.length - 1);
      const values = data.map((d: any) => d.value);
      const minVal = values.length > 0 ? Math.min(...values) * 0.95 : 0;
      const maxVal = values.length > 0 ? Math.max(...values) * 1.05 : 1;
      const range = maxVal - minVal || 1;
      const points = data.map((d: any, idx: number) => {
        const x = data.length === 1 ? width / 2 : padding + (idx / (data.length - 1)) * (width - padding * 2);
        const y = height - padding - ((d.value - minVal) / range) * (height - padding * 2);
        return { x, y, ...d };
      });
      const pathString = points.reduce((acc: string, pt: any, idx: number) => idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`, '');
      const areaString = points.length > 0 ? `${pathString} L ${points[points.length - 1].x} ${height - 15} L ${points[0].x} ${height - 15} Z` : '';
      return { points, pathString, areaString };
    };

    return {
      desktopChart: generateChartData(12, 700, 180, 40)
    };
  }, [rawData]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6 print:border-slate-300 print:shadow-none">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 gap-3">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-slate-500 dark:text-slate-400 print:hidden" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Historical Net Worth Trend</h3>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <span className="text-xs uppercase text-slate-500 dark:text-slate-400 font-medium">Timeline:</span>
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-mono font-bold focus:outline-none cursor-pointer shadow-sm">
            <option value="3m">Last 3 Months</option>
            <option value="6m">Last 6 Months</option>
            <option value="1y">Last 1 Year</option>
            <option value="3y">Last 3 Years</option>
            <option value="5y">Last 5 Years</option>
            <option value="10y">Last 10 Years</option>
          </select>
        </div>
      </div>
      <div className="pt-4 pb-2 px-1 border-b border-slate-100 dark:border-slate-800">
        {rawData.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-xs text-slate-400 font-mono">Loading timeline data...</div>
        ) : (
          <div className="block relative w-full overflow-hidden rounded-xl">
            <svg viewBox="0 0 700 180" className="w-full h-52 overflow-visible">
              <defs>
                <linearGradient id="areaGradientDesktop" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d={desktopChart.areaString} fill="url(#areaGradientDesktop)" />
              <path d={desktopChart.pathString} fill="none" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {desktopChart.points.map((pt: any, idx: number) => (
                <g key={idx} className="group cursor-pointer">
                  <circle cx={pt.x} cy={pt.y} r="5" className="fill-white dark:fill-slate-900 stroke-teal-700 stroke-2" />
                  <text x={pt.x} y={pt.y - 12} textAnchor="middle" className="text-[10px] font-mono fill-slate-700 dark:fill-slate-300 font-semibold">{formatCompactValue(pt.value)}</text>
                  <text x={pt.x} y={170} textAnchor="middle" className="text-[9px] font-mono fill-slate-400">{pt.month}</text>
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}