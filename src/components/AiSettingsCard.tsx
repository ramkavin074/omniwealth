'use client';

import { useState } from 'react';
import { updateAiSettingsAction } from '@/actions/ai-actions';
import { Cpu, CheckCircle2, ShieldCheck, Key } from 'lucide-react';

interface AiSettingsCardProps {
  initialGroq?: boolean;
  initialOpenrouter?: boolean;
  initialGemini?: boolean;
  initialOpenai?: boolean;
  initialAnthropic?: boolean;
}

export default function AiSettingsCard({ 
  initialGroq, 
  initialOpenrouter, 
  initialGemini, 
  initialOpenai, 
  initialAnthropic 
}: AiSettingsCardProps) {
  const [groqApiKey, setGroq] = useState('');
  const [openrouterApiKey, setOpenrouter] = useState('');
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
    formData.append('groqApiKey', groqApiKey);
    formData.append('openrouterApiKey', openrouterApiKey);
    formData.append('geminiApiKey', geminiApiKey);
    formData.append('openaiApiKey', openaiApiKey);
    formData.append('anthropicApiKey', anthropicApiKey);

    const res = await updateAiSettingsAction(formData);
    setLoading(false);

    if (res.success) {
      setSuccess(true);
      setGroq('');
      setOpenrouter('');
      setGemini('');
      setOpenai('');
      setAnthropic('');
    } else {
      setError(res.error || 'Failed to save settings.');
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-white uppercase">Multi-AI Free-First Cascade Settings (BYOK)</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-indigo-300 bg-indigo-950/60 border border-indigo-800/50 px-2.5 py-1 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          Encrypted Storage
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Configure your API keys below. The vault automatically prioritizes free providers first (<strong className="text-slate-200">Groq &rarr; OpenRouter &rarr; Gemini</strong>), cascading to paid backups only if needed.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* 1. Groq Key */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-semibold text-slate-300">1. Groq API Key (Free Tier - Ultra Fast Llama)</label>
            {initialGroq ? (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Stored in DB
              </span>
            ) : (
              <span className="text-[10px] text-slate-500">Not Configured</span>
            )}
          </div>
          <input type="password" value={groqApiKey} onChange={e => setGroq(e.target.value)} placeholder={initialGroq ? "••••••••••••••••••••" : "gsk_..."} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-indigo-500" />
          <p className="text-[10px] text-slate-500 mt-1">Get a free key at console.groq.com (No credit card required)</p>
        </div>

        {/* 2. OpenRouter Key */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-semibold text-slate-300">2. OpenRouter API Key (Free Models Router)</label>
            {initialOpenrouter ? (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Stored in DB
              </span>
            ) : (
              <span className="text-[10px] text-slate-500">Not Configured</span>
            )}
          </div>
          <input type="password" value={openrouterApiKey} onChange={e => setOpenrouter(e.target.value)} placeholder={initialOpenrouter ? "••••••••••••••••••••" : "sk-or-..."} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-indigo-500" />
          <p className="text-[10px] text-slate-500 mt-1">Get a free key at openrouter.ai (Access to rotating free models)</p>
        </div>

        {/* 3. Google Gemini Key */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-semibold text-slate-300">3. Google Gemini API Key (Free Tier / Paid)</label>
            {initialGemini ? (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Stored in DB
              </span>
            ) : (
              <span className="text-[10px] text-slate-500">Not Configured</span>
            )}
          </div>
          <input type="password" value={geminiApiKey} onChange={e => setGemini(e.target.value)} placeholder={initialGemini ? "••••••••••••••••••••" : "AIza..."} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-indigo-500" />
          <p className="text-[10px] text-slate-500 mt-1">Get a free key at aistudio.google.com</p>
        </div>

        {/* 4. OpenAI Key */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-semibold text-slate-300">4. OpenAI API Key (Paid Backup)</label>
            {initialOpenai ? (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Stored in DB
              </span>
            ) : (
              <span className="text-[10px] text-slate-500">Not Configured</span>
            )}
          </div>
          <input type="password" value={openaiApiKey} onChange={e => setOpenai(e.target.value)} placeholder={initialOpenai ? "••••••••••••••••••••" : "sk-..."} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-indigo-500" />
        </div>

        {/* 5. Anthropic Claude Key */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-semibold text-slate-300">5. Anthropic Claude API Key (Paid Backup)</label>
            {initialAnthropic ? (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Stored in DB
              </span>
            ) : (
              <span className="text-[10px] text-slate-500">Not Configured</span>
            )}
          </div>
          <input type="password" value={anthropicApiKey} onChange={e => setAnthropic(e.target.value)} placeholder={initialAnthropic ? "••••••••••••••••••••" : "sk-ant-..."} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-indigo-500" />
        </div>

        {error && <p className="text-rose-400">{error}</p>}
        {success && (
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" /> Keys updated &amp; saved to your database profile!
          </div>
        )}

        <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/20">
          {loading ? 'Saving Keys...' : 'Save AI Keys & Cascade Order'}
        </button>
      </form>
    </div>
  );
}