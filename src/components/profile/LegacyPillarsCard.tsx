'use client';

import { useState } from 'react';
import { Target, CheckCircle2 } from 'lucide-react';
import { updateHouseholdLegacyPillarsAction } from '@/actions/vault';

interface LegacyPillarsCardProps {
  householdDetails: any;
}

type Pillar = { name: string; description: string };

function parsePillars(raw: unknown): Pillar[] {
  const out: Pillar[] = [];
  try {
    const parsed = JSON.parse((raw as string) || '[]');
    if (Array.isArray(parsed)) {
      for (const p of parsed) {
        if (typeof p === 'string') out.push({ name: p, description: '' });
        else out.push({ name: p?.name || '', description: p?.description || '' });
      }
    }
  } catch {
    for (const p of String(raw || '').split(',')) {
      const [name, desc] = p.split(' - ');
      if (name?.trim()) out.push({ name: name.trim(), description: desc?.trim() || '' });
    }
  }
  while (out.length < 4) out.push({ name: '', description: '' });
  return out.slice(0, 4);
}

export default function LegacyPillarsCard({ householdDetails }: LegacyPillarsCardProps) {
  const [pillars, setPillars] = useState<Pillar[]>(() => parsePillars(householdDetails?.legacyPillars));
  const [selected, setSelected] = useState(0);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const p = pillars[selected];

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
    });
    const res = await updateHouseholdLegacyPillarsAction(fd);
    setLoading(false);
    if (res.success) {
      setSuccess(true);
      setTimeout(() => window.location.reload(), 800);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <Target className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Legacy &amp; Wealth Pillars</h2>
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

        <div className="flex justify-end pt-1">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl cursor-pointer transition-colors shadow-sm disabled:opacity-50">
            {loading ? 'Saving…' : 'Save Pillars'}
          </button>
        </div>
      </form>
    </div>
  );
}
