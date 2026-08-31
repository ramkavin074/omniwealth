'use client';

import { useMemo } from 'react';
import { formatCompact, formatFull } from '@/lib/format';

export default function NetWorthTrendChart({ trendData = [], baseCurrency, estimated = true, embedded = false }: any) {
  const rawData = Array.isArray(trendData) ? trendData.filter(d => d && d.value > 0) : [];
  const formatCompactValue = (val: number) => formatCompact(val, baseCurrency);

  const { desktopChart, mobileChart } = useMemo(() => {
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
      return { points, pathString, areaString, width, height };
    };

    return {
      desktopChart: generateChartData(12, 700, 180, 40),
      mobileChart: generateChartData(5, 300, 140, 30) // Restored mobile chart logic
    };
  }, [rawData]);

  const renderChart = (chart: any) => (
    <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="w-full h-full overflow-visible">
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f766e" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#0f766e" stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={chart.areaString} fill="url(#areaGradient)" />
      <path d={chart.pathString} fill="none" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {chart.points.map((pt: any, idx: number) => (
        <g key={idx} className="group cursor-pointer">
          {/* Restored tooltips and hover effects */}
          <title>{`${pt.month}: ${formatFull(pt.value, baseCurrency)} ${baseCurrency}`}</title>
          <circle cx={pt.x} cy={pt.y} r="5" className="fill-white dark:fill-slate-900 stroke-teal-700 stroke-2 group-hover:r-6 group-hover:fill-teal-700 transition-all duration-200" />
          <text x={pt.x} y={pt.y - 12} textAnchor="middle" className="text-[10px] font-mono fill-slate-700 dark:fill-slate-300 font-semibold opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
            {formatCompactValue(pt.value)}
          </text>
          <text x={pt.x} y={chart.height - 5} textAnchor="middle" className="text-[9px] font-mono fill-slate-400">
            {pt.month}
          </text>
        </g>
      ))}
    </svg>
  );

  return (
    <div className={embedded ? 'space-y-6' : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6 print:border-slate-300 print:shadow-none'}>
      {/* ... header and select dropdown ... */}
      
      <div className="pt-4 pb-2 px-1 border-b border-slate-100 dark:border-slate-800">
        {rawData.length === 0 ? (
          <div className="h-40 md:h-52 flex items-center justify-center text-xs text-slate-400 font-mono">Loading timeline data...</div>
        ) : (
          <>
            {/* Restored responsive layout: Mobile uses smaller 5-point chart, Desktop uses 12-point chart */}
            <div className="block sm:hidden relative w-full h-40 overflow-hidden rounded-xl">
              {renderChart(mobileChart)}
            </div>
            <div className="hidden sm:block relative w-full h-52 overflow-hidden rounded-xl">
              {renderChart(desktopChart)}
            </div>
            {estimated ? (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 pt-2">
                Historical points are estimated from current holdings and recorded transactions, not day-by-day snapshots.
              </p>
            ) : (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 pt-2">
                Based on daily recorded snapshots of your net worth.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}