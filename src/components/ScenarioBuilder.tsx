'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { saveScenarioAction } from '@/actions/scenarios';
import { CURRENCIES } from '@/lib/onboarding';
import { MAX_EVENTS, TEMPLATES, type ScenarioConfig } from '@/lib/scenarioConfig';

const INPUT =
  'w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-teal-600';
const LABEL = 'block text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1';

interface EventRow {
  label: string;
  fromYear: string;
  toYear: string;
  amount: string;
  inflow: boolean;
}

interface FormState {
  name: string;
  retirementAge: string;
  monthlySpend: string;
  spendCurrency: string;
  spendDriftPct: string;
  returnPct: string;
  inflationPct: string;
  marketDropPct: string;
  events: EventRow[];
}

const empty = (currency: string): FormState => ({
  name: '',
  retirementAge: '',
  monthlySpend: '',
  spendCurrency: currency,
  spendDriftPct: '0',
  returnPct: '',
  inflationPct: '',
  marketDropPct: '',
  events: [],
});

export default function ScenarioBuilder({ planCurrency, onClose }: { planCurrency: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [f, setF] = useState<FormState>(() => empty(planCurrency));
  const year = new Date().getFullYear();
  const set = (patch: Partial<FormState>) => setF((cur) => ({ ...cur, ...patch }));
  const crossCurrency = f.spendCurrency !== planCurrency;
  const drift = parseFloat(f.spendDriftPct) || 0;

  const applyTemplate = (cfg: ScenarioConfig, name: string) =>
    set({
      name,
      retirementAge: cfg.retirementAge !== undefined ? String(cfg.retirementAge) : '',
      marketDropPct: cfg.marketDropPct !== undefined ? String(cfg.marketDropPct) : '',
    });

  const updateEvent = (i: number, patch: Partial<EventRow>) =>
    set({ events: f.events.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const config: Record<string, unknown> = {};
    if (f.retirementAge) config.retirementAge = f.retirementAge;
    if (f.monthlySpend) {
      config.monthlySpend = f.monthlySpend;
      config.spendCurrency = f.spendCurrency;
      if (crossCurrency) config.spendDriftPct = f.spendDriftPct;
    }
    if (f.returnPct) config.returnPct = f.returnPct;
    if (f.inflationPct) config.inflationPct = f.inflationPct;
    if (f.marketDropPct) config.marketDropPct = f.marketDropPct;
    config.events = f.events.map((ev) => ({
      label: ev.label,
      fromYear: ev.fromYear,
      toYear: ev.toYear || ev.fromYear,
      amount: ev.inflow ? -Math.abs(parseFloat(ev.amount) || 0) : Math.abs(parseFloat(ev.amount) || 0),
    }));
    start(async () => {
      setError('');
      const res = await saveScenarioAction({ name: f.name, config });
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.refresh();
      onClose();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-teal-200 dark:border-teal-900/60 bg-white dark:bg-slate-900 p-4">
      <div>
        <p className={LABEL}>Start from a template (optional)</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button key={t.key} type="button" onClick={() => applyTemplate(t.config, t.name)} className="text-xs px-2.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-600 cursor-pointer">
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className={LABEL}>Name</span>
        <input required maxLength={60} value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Move to India at 58" className={INPUT} />
      </label>

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Only fill in what changes. Anything left blank uses your current plan.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={LABEL}>Retire at age</span>
          <input type="number" inputMode="numeric" value={f.retirementAge} onChange={(e) => set({ retirementAge: e.target.value })} className={`${INPUT} font-mono`} />
        </label>
        <label className="block">
          <span className={LABEL}>Market drop %</span>
          <input type="number" inputMode="decimal" value={f.marketDropPct} onChange={(e) => set({ marketDropPct: e.target.value })} placeholder="at retirement, e.g. 30" className={`${INPUT} font-mono`} />
        </label>
        <label className="block">
          <span className={LABEL}>Expected return %</span>
          <input type="number" inputMode="decimal" step="any" value={f.returnPct} onChange={(e) => set({ returnPct: e.target.value })} className={`${INPUT} font-mono`} />
        </label>
        <label className="block">
          <span className={LABEL}>Inflation %</span>
          <input type="number" inputMode="decimal" step="any" value={f.inflationPct} onChange={(e) => set({ inflationPct: e.target.value })} className={`${INPUT} font-mono`} />
        </label>
      </div>

      <div className="space-y-2 rounded-lg bg-slate-50 dark:bg-slate-950 p-3">
        <p className={LABEL}>Monthly spending in retirement</p>
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <input type="number" inputMode="numeric" aria-label="Monthly spending" value={f.monthlySpend} onChange={(e) => set({ monthlySpend: e.target.value })} placeholder="Same as current plan" className={`${INPUT} font-mono`} />
          <select aria-label="Spending currency" value={f.spendCurrency} onChange={(e) => set({ spendCurrency: e.target.value })} className={INPUT}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        {crossCurrency && f.monthlySpend && (
          <div className="space-y-1">
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              You&rsquo;ll spend in {f.spendCurrency} but your savings are in {planCurrency}. How does {f.spendCurrency} move
              against {planCurrency} each year, beyond inflation?
            </p>
            <input type="range" min={-5} max={5} step={0.5} value={drift} onChange={(e) => set({ spendDriftPct: e.target.value })} className="w-full accent-teal-700 cursor-pointer" aria-label="Yearly currency drift" />
            <p className="text-[11px] font-semibold text-teal-700 dark:text-teal-400">
              {drift === 0
                ? 'No drift: costs track inflation'
                : drift > 0
                  ? `${f.spendCurrency} gets ${drift}% dearer each year (costs rise faster)`
                  : `${f.spendCurrency} gets ${Math.abs(drift)}% cheaper each year (costs rise slower)`}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className={LABEL}>Life events (optional)</p>
        {f.events.map((ev, i) => (
          <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 space-y-2">
            <div className="flex gap-2">
              <input aria-label="Event" maxLength={60} value={ev.label} onChange={(e) => updateEvent(i, { label: e.target.value })} placeholder="e.g. Krithik's college" className={INPUT} />
              <button type="button" aria-label="Remove event" onClick={() => set({ events: f.events.filter((_, idx) => idx !== i) })} className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input aria-label="From year" type="number" inputMode="numeric" min={year} value={ev.fromYear} onChange={(e) => updateEvent(i, { fromYear: e.target.value })} placeholder={String(year + 5)} className={`${INPUT} font-mono`} />
              <input aria-label="To year (optional)" type="number" inputMode="numeric" value={ev.toYear} onChange={(e) => updateEvent(i, { toYear: e.target.value })} placeholder="to (opt.)" className={`${INPUT} font-mono`} />
              <input aria-label={`Amount per year in ${planCurrency}`} type="number" inputMode="numeric" value={ev.amount} onChange={(e) => updateEvent(i, { amount: e.target.value })} placeholder={`${planCurrency}/yr`} className={`${INPUT} font-mono`} />
            </div>
            <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={ev.inflow} onChange={(e) => updateEvent(i, { inflow: e.target.checked })} />
              This brings money in (e.g. selling a house) instead of costing money
            </label>
          </div>
        ))}
        {f.events.length < MAX_EVENTS && (
          <button type="button" onClick={() => set({ events: [...f.events, { label: '', fromYear: '', toYear: '', amount: '', inflow: false }] })} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Add a life event
          </button>
        )}
        <p className="text-[10px] text-slate-400">Amounts are per year in today&rsquo;s {planCurrency}. A one-off event only needs a from year.</p>
      </div>

      {error ? (
        <div role="alert" className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-2.5 rounded-lg">
          {error}
        </div>
      ) : null}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="px-3.5 py-2 bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-50 inline-flex items-center gap-2">
          {pending && <Loader2 className="w-4 h-4 animate-spin" />} Save scenario
        </button>
        <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer">
          Cancel
        </button>
      </div>
    </form>
  );
}
