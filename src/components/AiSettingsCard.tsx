'use client';

import { useState } from 'react';
import { updateAiSettingsAction } from '@/actions/ai-actions';
import { Cpu, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function AiSettingsCard({
  configured = {},
}: {
  configured?: Partial<Record<string, boolean>>;
}) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Any provider key counts as "configured" for the on/off state.
  const isConfigured = Object.values(configured).some(Boolean);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    setError('');
    setSuccess(false);

    const formData = new FormData();
    formData.append('geminiApiKey', value.trim());
    const res = await updateAiSettingsAction(formData);
    setLoading(false);

    if (res.success) {
      setSuccess(true);
      setValue('');
    } else {
      setError(res.error || 'Failed to save key.');
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-teal-700 dark:text-teal-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">AI key</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 px-2.5 py-1 rounded-full font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          Encrypted
        </div>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        The statement reader and portfolio chat work out of the box on a shared key. Add your own
        Google&nbsp;Gemini key (<a className="underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com</a>, free tier) only if you&rsquo;d rather use your own quota.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <div>
          <label className="block text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
            <span>Gemini API key</span>
            {isConfigured ? (
              <span className="text-emerald-700 dark:text-emerald-300 flex items-center gap-1 normal-case font-bold">
                <CheckCircle2 className="w-3 h-3" /> Using your key
              </span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500 normal-case">Shared key</span>
            )}
          </label>
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={isConfigured ? '•••••••••••••• (enter a new key to replace)' : 'AIza…'}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-teal-600 shadow-sm"
          />
        </div>

        {error && <p className="text-rose-600 dark:text-rose-400 font-medium">{error}</p>}
        {success && (
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-3 rounded-xl">
            <CheckCircle2 className="w-4 h-4" /> Key saved. Reload to see the status update.
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || !value.trim()}
            className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save key'}
          </button>
        </div>
      </form>
    </div>
  );
}
