'use client';

import { useState } from 'react';
import { updateAiSettingsAction } from '@/actions/ai-actions';
import { Cpu, Key, CheckCircle2 } from 'lucide-react';

export default function AiSettingsCard({ initialGemini, initialOpenai, initialAnthropic }: { initialGemini?: boolean; initialOpenai?: boolean; initialAnthropic?: boolean }) {
  const [geminiApiKey, setGemini] = useState('');
  const [openaiApiKey, setOpenai] = useState('');
  const [anthropicApiKey, setAnthropic] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    const formData = new FormData();
    formData.append('geminiApiKey', geminiApiKey);
    formData.append('openaiApiKey', openaiApiKey);
    formData.append('anthropicApiKey', anthropicApiKey);

    const res = await updateAiSettingsAction(formData);
    setLoading(false);

    if (res.success) {
      setSuccess(true);
      setGemini('');
      setOpenai('');
      setAnthropic('');
    } else {
      setError(res.error || 'Failed to save backup keys.');
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
        <Cpu className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-bold text-white uppercase">Multi-AI Failover &amp; Backup Keys (BYOK)</h3>
      </div>

      <p className="text-xs text-slate-400">
        Configure your personal API keys below. If Google Gemini experiences high demand (503 error), your vault will automatically cascade to OpenAI or Claude seamlessly.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-semibold text-slate-300 mb-1">
            Google Gemini API Key {initialGemini && <span className="text-emerald-400 font-normal">(Configured)</span>}
          </label>
          <input 
            type="password" 
            value={geminiApiKey} 
            onChange={e => setGemini(e.target.value)} 
            placeholder="AIza..." 
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-indigo-500" 
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-300 mb-1">
            OpenAI API Key {initialOpenai && <span className="text-emerald-400 font-normal">(Configured)</span>}
          </label>
          <input 
            type="password" 
            value={openaiApiKey} 
            onChange={e => setOpenai(e.target.value)} 
            placeholder="sk-..." 
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-indigo-500" 
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-300 mb-1">
            Anthropic Claude API Key {initialAnthropic && <span className="text-emerald-400 font-normal">(Configured)</span>}
          </label>
          <input 
            type="password" 
            value={anthropicApiKey} 
            onChange={e => setAnthropic(e.target.value)} 
            placeholder="sk-ant-..." 
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-indigo-500" 
          />
        </div>

        {error && <p className="text-rose-400 text-xs">{error}</p>}
        {success && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="w-4 h-4" /> AI backup keys saved successfully!
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading} 
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/20"
        >
          {loading ? 'Saving Keys...' : 'Save AI Backup Keys'}
        </button>
      </form>
    </div>
  );
}