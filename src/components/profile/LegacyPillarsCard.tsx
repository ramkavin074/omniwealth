'use client';

import { useState } from 'react';
import { Target, CheckCircle2 } from 'lucide-react';
import { updateHouseholdLegacyPillarsAction } from '@/actions/vault';

interface LegacyPillarsCardProps {
  householdDetails: any;
}

export default function LegacyPillarsCard({ householdDetails }: LegacyPillarsCardProps) {
  const [pillarSuccess, setPillarSuccess] = useState('');

  let currentPillars: { name: string; description: string }[] = [];
  try {
    currentPillars = JSON.parse(householdDetails?.legacyPillars || '[]');
  } catch (e) {
    currentPillars = (householdDetails?.legacyPillars || '').split(',').map((p: string) => {
      const parts = p.split(' - ');
      return { name: parts[0]?.trim() || p, description: parts[1]?.trim() || '' };
    });
  }

  async function handlePillarUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPillarSuccess('');
    const formData = new FormData(e.currentTarget);
    const res = await updateHouseholdLegacyPillarsAction(formData);
    if (res.success) {
      setPillarSuccess('Legacy pillars updated successfully!');
      setTimeout(() => window.location.reload(), 800);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <Target className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Customizable Legacy &amp; Wealth Pillars</h2>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400">Define up to 4 core pillars with dedicated names and estate directives.</p>

      {pillarSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs p-3 rounded-xl flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> {pillarSuccess}
        </div>
      )}

      <form onSubmit={handlePillarUpdate} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((idx) => {
            const item = currentPillars[idx] || { name: '', description: '' };
            return (
              <div key={idx} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-teal-700 dark:text-teal-400 tracking-wider">Pillar {idx + 1}</div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 mb-1 font-medium">Pillar Name</label>
                    <input 
                      name={`pillar_name_${idx}`} 
                      defaultValue={item.name} 
                      placeholder="e.g. Next Generation Family Trust" 
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-teal-600 shadow-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-500 dark:text-slate-400 mb-1 font-medium">Description / Directive</label>
                    <textarea 
                      name={`pillar_desc_${idx}`} 
                      defaultValue={item.description} 
                      rows={3}
                      placeholder="e.g. Disbursed upon reaching age 35 for education and housing" 
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-teal-600 resize-none shadow-sm leading-relaxed" 
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end pt-2">
          <button type="submit" className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl cursor-pointer transition-colors shadow-sm">
            Save Pillars
          </button>
        </div>
      </form>
    </div>
  );
}