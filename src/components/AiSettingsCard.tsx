'use client';

import { useState } from 'react';
import { updateAiSettingsAction } from '@/actions/ai-actions';
import { Cpu, CheckCircle2, ShieldCheck } from 'lucide-react';

type ProviderKey =
  | 'groqApiKey'
  | 'cerebrasApiKey'
  | 'openrouterApiKey'
  | 'geminiApiKey'
  | 'openaiApiKey'
  | 'anthropicApiKey';

const PROVIDERS: {
  field: ProviderKey;
  label: string;
  placeholder: string;
  hint: string;
  tier: 'free' | 'paid';
}[] = [
  { field: 'groqApiKey', label: 'Groq', placeholder: 'gsk_...', hint: 'console.groq.com — free, no card', tier: 'free' },
  { field: 'cerebrasApiKey', label: 'Cerebras', placeholder: 'csk-...', hint: 'cloud.cerebras.ai — free, no card', tier: 'free' },
  { field: 'openrouterApiKey', label: 'OpenRouter', placeholder: 'sk-or-...', hint: 'openrouter.ai — free models router', tier: 'free' },
  { field: 'geminiApiKey', label: 'Google Gemini', placeholder: 'AIza...', hint: 'aistudio.google.com — free tier', tier: 'free' },
  { field: 'openaiApiKey', label: 'OpenAI', placeholder: 'sk-...', hint: 'platform.openai.com — paid', tier: 'paid' },
  { field: 'anthropicApiKey', label: 'Anthropic Claude', placeholder: 'sk-ant-...', hint: 'console.anthropic.com — paid', tier: 'paid' },
];

export default function AiSettingsCard({
  configured = {},
}: {
  configured?: Partial<Record<ProviderKey, boolean>>;
}) {
  const [field, setField] = useState<ProviderKey>('groqApiKey');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const current = PROVIDERS.find((p) => p.field === field)!;
  const isConfigured = Boolean(configured[field]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    setError('');
    setSuccess(false);

    const formData = new FormData();
    formData.append(field, value.trim());
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
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5 transition-colors">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-teal-700 dark:text-teal-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">AI Provider Keys (BYOK)</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 px-2.5 py-1 rounded-full font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          Encrypted
        </div>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        The vault tries free providers first (Groq &rarr; Cerebras &rarr; OpenRouter &rarr; Gemini),
        then any paid keys. Pick a provider, paste its key, save.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="sm:w-48 shrink-0">
            <label className="block text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1">Provider</label>
            <select
              value={field}
              onChange={(e) => { setField(e.target.value as ProviderKey); setValue(''); setError(''); setSuccess(false); }}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 cursor-pointer"
            >
              {PROVIDERS.map((p) => (
                <option key={p.field} value={p.field}>
                  {p.label} {p.tier === 'free' ? '(free)' : ''} {configured[p.field] ? '✓' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
              <span>{current.label} API Key</span>
              {isConfigured ? (
                <span className="text-emerald-700 dark:text-emerald-300 flex items-center gap-1 normal-case font-bold">
                  <CheckCircle2 className="w-3 h-3" /> Secured
                </span>
              ) : (
                <span className="text-slate-400 dark:text-slate-500 normal-case">Not configured</span>
              )}
            </label>
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={isConfigured ? '•••••••••••••• (enter a new key to replace)' : current.placeholder}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-teal-600 shadow-sm"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{current.hint}</p>
          </div>
        </div>

        {error && <p className="text-rose-600 dark:text-rose-400 font-medium">{error}</p>}
        {success && (
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-3 rounded-xl">
            <CheckCircle2 className="w-4 h-4" /> {current.label} key saved. Reload to see the ✓.
          </div>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={loading || !value.trim()} className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl transition cursor-pointer disabled:opacity-50">
            {loading ? 'Saving…' : `Save ${current.label} key`}
          </button>
        </div>
      </form>
    </div>
  );
}
