'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { updateHouseholdBaseCurrencyAction } from '@/actions/settings';
import { updateHouseholdLegacyPillarsAction, updateRetirementPreferencesAction } from '@/actions/vault';
import { CURRENCIES, GOAL_PRESETS, REGIONS, goalTargetFor, regionByKey } from '@/lib/onboarding';

interface GoalRow {
  name: string;
  description: string;
  target: string;
  date: string;
}

const INPUT =
  'w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20';
const PRIMARY =
  'px-4 py-2.5 bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold rounded-lg cursor-pointer transition-colors disabled:opacity-50 inline-flex items-center gap-2';
const GHOST =
  'px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer';

/**
 * Optional first-run setup, offered once right after owner sign-up
 * (/?welcome=1). Every step has sensible presets and can be skipped; each
 * step saves as it goes, so leaving part-way keeps what was done.
 */
export default function SetupWizard({
  baseCurrency,
  initialCountry,
  initialCurrentAge,
  initialRetirementAge,
}: {
  baseCurrency: string;
  initialCountry: string;
  initialCurrentAge: number;
  initialRetirementAge: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [regionKey, setRegionKey] = useState(regionByKey(initialCountry).key);
  const [currency, setCurrency] = useState(baseCurrency || 'USD');
  const region = regionByKey(regionKey);

  const [currentAge, setCurrentAge] = useState(String(initialCurrentAge));
  const [retireAge, setRetireAge] = useState(String(initialRetirementAge));
  const [income, setIncome] = useState(String(region.income));

  const makeRows = (r = region): GoalRow[] =>
    GOAL_PRESETS.slice(0, 2).map((p) => ({
      name: p.name,
      description: p.description,
      target: String(goalTargetFor(p, r)),
      date: '',
    }));
  const [goals, setGoals] = useState<GoalRow[]>(() => makeRows());

  if (!open) return null;

  const close = () => {
    setOpen(false);
    router.replace('/');
    router.refresh();
  };

  const pickRegion = (key: string) => {
    const r = regionByKey(key);
    setRegionKey(key);
    setCurrency(r.currency);
    setIncome(String(r.income));
    setGoals(makeRows(r));
  };

  async function run(task: () => Promise<{ success?: boolean; error?: string } | void>, next: () => void) {
    setBusy(true);
    setError('');
    try {
      const res = await task();
      if (res && res.success === false) {
        setError(res.error || 'Could not save. Please try again.');
        return;
      }
      next();
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const saveBasics = () =>
    run(
      async () => {
        if (currency !== baseCurrency) return updateHouseholdBaseCurrencyAction(currency);
      },
      () => setStep(1),
    );

  const saveAbout = () => {
    const cAge = Number(currentAge);
    const rAge = Number(retireAge);
    const inc = Number(income);
    if (!(cAge >= 18 && cAge <= 100) || !(rAge > cAge && rAge <= 100) || !(inc > 0)) {
      setError('Enter your age, a later retirement age, and a yearly income above zero.');
      return;
    }
    return run(
      () => updateRetirementPreferencesAction({ currentAge: cAge, retirementAge: rAge, desiredIncome: inc, country: regionKey }),
      () => setStep(2),
    );
  };

  const saveGoals = () => {
    const rows = goals.filter((g) => g.name.trim());
    if (rows.length === 0) return close();
    const fd = new FormData();
    rows.slice(0, 4).forEach((g, i) => {
      fd.set(`pillar_name_${i}`, g.name.trim());
      fd.set(`pillar_desc_${i}`, g.description.trim());
      fd.set(`pillar_target_${i}`, g.target);
      fd.set(`pillar_target_date_${i}`, g.date);
    });
    return run(() => updateHouseholdLegacyPillarsAction(fd), close);
  };

  const setGoal = (i: number, patch: Partial<GoalRow>) =>
    setGoals((g) => g.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const titles = ['Where are you based?', 'About retirement', 'What are you saving for?'];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm overflow-y-auto p-4 flex items-start sm:items-center justify-center print:hidden">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Set up OmniWealth"
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 my-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
              Quick setup · step {step + 1} of 3 · optional
            </p>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{titles[step]}</h2>
          </div>
          <button type="button" onClick={close} aria-label="Skip setup" className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
          ))}
        </div>

        {error ? (
          <div role="alert" className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-2.5 rounded-lg">
            {error}
          </div>
        ) : null}

        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              We&rsquo;ll preset sensible defaults for your region. You can change any of this later in Settings.
            </p>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Country you plan to retire in
              <select value={regionKey} onChange={(e) => pickRegion(e.target.value)} className={`${INPUT} mt-1`}>
                {REGIONS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Currency to show your net worth in
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={`${INPUT} mt-1`}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={close} className={GHOST}>
                Skip setup
              </button>
              <button type="button" onClick={saveBasics} disabled={busy} className={PRIMARY}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Continue
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              This powers the retirement tab. The income is a typical figure for {region.label}; change it to what you
              would like to live on each year (in today&rsquo;s money).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Your age
                <input type="number" inputMode="numeric" value={currentAge} onChange={(e) => setCurrentAge(e.target.value)} className={`${INPUT} mt-1 font-mono`} />
              </label>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Retire at
                <input type="number" inputMode="numeric" value={retireAge} onChange={(e) => setRetireAge(e.target.value)} className={`${INPUT} mt-1 font-mono`} />
              </label>
            </div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Yearly income wanted in retirement ({region.currency})
              <input type="number" inputMode="numeric" value={income} onChange={(e) => setIncome(e.target.value)} className={`${INPUT} mt-1 font-mono`} />
            </label>
            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={() => { setError(''); setStep(2); }} className={GHOST}>
                Skip this step
              </button>
              <button type="button" onClick={saveAbout} disabled={busy} className={PRIMARY}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Continue
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1.5">
              <p>
                These two are just examples to get you started. Make them yours: rename a goal, change the amount (in{' '}
                {currency}), add a target date, or remove it with the bin icon.
              </p>
              <p>
                Use the buttons below to add another idea or write your own, up to four goals. Later, tag a holding
                with a goal and its value counts toward that goal&rsquo;s progress.
              </p>
            </div>
            <ul className="space-y-3">
              {goals.map((g, i) => (
                <li key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                  <div className="flex gap-2">
                    <input aria-label="Goal name" value={g.name} onChange={(e) => setGoal(i, { name: e.target.value })} placeholder="e.g. Daughter's college fund" className={INPUT} />
                    <button type="button" aria-label="Remove goal" onClick={() => setGoals((r) => r.filter((_, idx) => idx !== i))} className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input aria-label="Target amount" type="number" inputMode="numeric" value={g.target} onChange={(e) => setGoal(i, { target: e.target.value })} placeholder="Target amount" className={`${INPUT} font-mono`} />
                    <input aria-label="Target date (optional)" type="date" value={g.date} onChange={(e) => setGoal(i, { date: e.target.value })} className={INPUT} />
                  </div>
                </li>
              ))}
            </ul>
            {goals.length < 4 && (
              <div className="flex flex-wrap gap-2">
                {GOAL_PRESETS.filter((p) => !goals.some((g) => g.name === p.name)).map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() =>
                      setGoals((r) => [...r, { name: p.name, description: p.description, target: String(goalTargetFor(p, region)), date: '' }])
                    }
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-600 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> {p.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setGoals((r) => [...r, { name: '', description: '', target: '', date: '' }])}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-teal-600 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Custom
                </button>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={close} className={GHOST}>
                Skip goals
              </button>
              <button type="button" onClick={saveGoals} disabled={busy} className={PRIMARY}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Finish
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
