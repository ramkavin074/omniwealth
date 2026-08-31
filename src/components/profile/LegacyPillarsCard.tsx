'use client';

import { useMemo, useState } from 'react';
import { Target, CheckCircle2 } from 'lucide-react';
import { updateHouseholdLegacyPillarsAction } from '@/actions/vault';
import { formatCompact } from '@/lib/format';

interface LegacyPillarsCardProps {
  householdDetails: any;
  assets?: any[];
  baseCurrency?: string;
  liveRates?: { [key: string]: number };
}

type Pillar = {
  name: string;
  description: string;
  target: number | null;
  targetDate: string | null;
};

function convertCurrency(amount: number, from: string, to: string, rates: { [key: string]: number }): number {
  if (!from || !to || from === to) return amount;
  const rf = rates[from] || 1;
  const rt = rates[to] || 1;
  return (amount * rt) / rf;
}

function toPillar(p: any): Pillar {
  if (typeof p === 'string') return { name: p, description: '', target: null, targetDate: null };
  const t = typeof p?.target === 'number' && p.target > 0 ? p.target : null;
  const d = typeof p?.targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.targetDate) ? p.targetDate : null;
  return { name: p?.name || '', description: p?.description || '', target: t, targetDate: d };
}

function parsePillars(raw: unknown): Pillar[] {
  const out: Pillar[] = [];
  try {
    const parsed = JSON.parse((raw as string) || '[]');
    if (Array.isArray(parsed)) {
      for (const p of parsed) out.push(toPillar(p));
    }
  } catch {
    for (const p of String(raw || '').split(',')) {
      const [name, desc] = p.split(' - ');
      if (name?.trim()) out.push({ name: name.trim(), description: desc?.trim() || '', target: null, targetDate: null });
    }
  }
  while (out.length < 4) out.push({ name: '', description: '', target: null, targetDate: null });
  return out.slice(0, 4);
}

function daysUntil(dateStr: string): number {
  const then = new Date(`${dateStr}T00:00:00`).getTime();
  return Math.round((then - Date.now()) / 86400000);
}

export default function LegacyPillarsCard({
  householdDetails,
  assets = [],
  baseCurrency = 'USD',
  liveRates = {},
}: LegacyPillarsCardProps) {
  const [pillars, setPillars] = useState<Pillar[]>(() => parsePillars(householdDetails?.legacyPillars));
  const [selected, setSelected] = useState(0);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const p = pillars[selected];

  // Current value assigned to each pillar = sum of assets whose rationale
  // matches the pillar name, converted to the base currency.
  const currentByName = useMemo(() => {
    const map: { [name: string]: number } = {};
    for (const a of assets) {
      const type = (a.assetType || '').toUpperCase();
      const cat = (a.accountCategory || '').toUpperCase();
      if (type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY') continue;
      const name = (a.rationale || '').trim();
      if (!name) continue;
      const val = Math.abs(
        convertCurrency(parseFloat(a.nativeValue || '0'), a.nativeCurrency || 'USD', baseCurrency, liveRates),
      );
      map[name] = (map[name] || 0) + val;
    }
    return map;
  }, [assets, baseCurrency, liveRates]);

  function update(patch: Partial<Pillar>) {
    setPillars((prev) => prev.map((x, i) => (i === selected ? { ...x, ...patch } : x)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    const fd = new FormData();
    pillars.forEach((x, i) => {
      fd.append(`pillar_name_${i}`, x.name);
      fd.append(`pillar_desc_${i}`, x.description);
      fd.append(`pillar_target_${i}`, x.target != null ? String(x.target) : '');
      fd.append(`pillar_target_date_${i}`, x.targetDate || '');
    });
    const res = await updateHouseholdLegacyPillarsAction(fd);
    setLoading(false);
    if (res.success) {
      setSuccess(true);
      setTimeout(() => window.location.reload(), 800);
    }
  }

  const current = p.name ? currentByName[p.name.trim()] || 0 : 0;
  const pct = p.target && p.target > 0 ? Math.min(100, (current / p.target) * 100) : 0;
  const remainingDays = p.targetDate ? daysUntil(p.targetDate) : null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <Target className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Wealth pillars</h2>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400">Up to 4 core pillars with estate directives. Pick one to edit, then save.</p>

      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs p-3 rounded-xl flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Pillars saved.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <div>
          <label className="block text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1">Pillar</label>
          <select
            value={selected}
            onChange={(e) => setSelected(Number(e.target.value))}
            className="w-full sm:w-64 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 cursor-pointer"
          >
            {pillars.map((x, i) => (
              <option key={i} value={i}>
                Pillar {i + 1}{x.name ? ` — ${x.name}` : ' (empty)'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 mb-1 font-medium">Pillar Name</label>
          <input
            value={p.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="e.g. Next Generation Family Trust"
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-teal-600 shadow-sm"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 mb-1 font-medium">Description / Directive</label>
          <textarea
            value={p.description}
            onChange={(e) => update({ description: e.target.value })}
            rows={3}
            placeholder="e.g. Disbursed upon reaching age 35 for education and housing"
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-teal-600 resize-none shadow-sm leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 mb-1 font-medium">
              Target Amount ({baseCurrency}) <span className="normal-case text-slate-400">— optional</span>
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={p.target ?? ''}
              onChange={(e) => update({ target: e.target.value ? parseFloat(e.target.value) : null })}
              placeholder="e.g. 500000"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-teal-600 shadow-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 mb-1 font-medium">
              Target Date <span className="normal-case text-slate-400">— optional</span>
            </label>
            <input
              type="date"
              value={p.targetDate ?? ''}
              onChange={(e) => update({ targetDate: e.target.value || null })}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 shadow-sm"
            />
          </div>
        </div>

        {p.name && p.target && p.target > 0 && (
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-1.5">
            <div className="flex items-baseline justify-between text-[11px] font-mono">
              <span className="text-slate-700 dark:text-slate-200 font-semibold">
                {formatCompact(current, baseCurrency)} / {formatCompact(p.target, baseCurrency)} {baseCurrency}
              </span>
              <span className="text-slate-500 dark:text-slate-400">{pct.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-600' : 'bg-teal-600'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {remainingDays != null && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {remainingDays > 0
                  ? `${remainingDays} day(s) to target date`
                  : remainingDays === 0
                    ? 'Target date is today'
                    : `Target date passed ${Math.abs(remainingDays)} day(s) ago`}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl cursor-pointer transition-colors shadow-sm disabled:opacity-50">
            {loading ? 'Saving…' : 'Save Pillars'}
          </button>
        </div>
      </form>
    </div>
  );
}
