'use client';

import { useState } from 'react';
import { updateAiSettingsAction } from '@/actions/ai-actions';
import { Cpu, Key, CheckCircle2 } from 'lucide-react';

export default function AiSettingsCard({ initialProvider, initialHasKey }: { initialProvider: string; initialHasKey: boolean }) {
  const [provider, setProvider] = useState(initialProvider || 'gemini');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    const formData = new FormData();
    formData.append('aiProvider', provider);
    formData.append('aiApiKey', apiKey);

    const res = await updateAiSettingsAction(formData);
    setLoading(false);

    if (res.success) {
      setSuccess(true);
      setApiKey('');
    } else {
      setError(res.error || 'Failed to save settings.');
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
        <Cpu className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-bold text-white uppercase">Personal AI Assistant Settings (BYOK)</h3>
      </div>

      <p className="text-xs text-slate-400">
        Plug in your own AI API key to power statement parsing and portfolio Q&amp;A. This keeps costs free for the app and ensures total privacy under your own account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">AI Provider</label>
          <select 
            value={provider} 
            onChange={(e) => setProvider(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="gemini">Google Gemini (Free tier available at Google AI Studio)</option>
            <option value="openai">OpenAI (ChatGPT)</option>
            <option value="anthropic">Anthropic (Claude)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            {initialHasKey ? 'Update API Key (Leave blank to keep existing)' : 'API Key'}
          </label>
          <div className="relative">
            <Key className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
            <input 
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your personal API key here..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-3 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}
        {success && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="w-4 h-4" /> AI settings saved successfully!
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20"
        >
          {loading ? 'Saving...' : 'Save AI Settings'}
        </button>
      </form>
    </div>
  );
}