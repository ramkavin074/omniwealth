'use client';

import { useState } from 'react';
import { updateAiSettingsAction } from '@/actions/ai-actions';
import { Cpu, CheckCircle2, ShieldCheck } from 'lucide-react';

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
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-teal-700" />
          <h3 className="text-sm font-bold text-slate-900 uppercase">Multi-AI Free-First Cascade Settings (BYOK)</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
          Encrypted Storage
        </div>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed">
        Configure your API keys below. The vault automatically prioritizes free providers first (<strong className="text-slate-900">Groq &rarr; OpenRouter &rarr; Gemini</strong>), cascading to paid backups only if needed.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* 1. Groq Key */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <label className="font-semibold text-slate-800">1. Groq API Key (Free Tier - Ultra Fast Llama)</label>
            {initialGroq ? (
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Stored in DB
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-mono">Not Configured</span>
            )}
          </div>
          <input 
            type="password" 
            value={groqApiKey} 
            onChange={e => setGroq(e.target.value)} 
            placeholder={initialGroq ? "••••••••••••••••••••" : "gsk_..."} 
            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-mono focus:outline-none focus:border-teal-600 shadow-sm" 
          />
          <p className="text-[10px] text-slate-500 mt-1">Get a free key at console.groq.com (No credit card required)</p>
        </div>

        {/* 2. OpenRouter Key */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <label className="font-semibold text-slate-800">2. OpenRouter API Key (Free Models Router)</label>
            {initialOpenrouter ? (
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Stored in DB
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-mono">Not Configured</span>
            )}
          </div>
          <input 
            type="password" 
            value={openrouterApiKey} 
            onChange={e => setOpenrouter(e.target.value)} 
            placeholder={initialOpenrouter ? "••••••••••••••••••••" : "sk-or-..."} 
            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-mono focus:outline-none focus:border-teal-600 shadow-sm" 
          />
          <p className="text-[10px] text-slate-500 mt-1">Get a free key at openrouter.ai (Access to rotating free models)</p>
        </div>

        {/* 3. Google Gemini Key */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <label className="font-semibold text-slate-800">3. Google Gemini API Key (Free Tier / Paid)</label>
            {initialGemini ? (
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Stored in DB
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-mono">Not Configured</span>
            )}
          </div>
          <input 
            type="password" 
            value={geminiApiKey} 
            onChange={e => setGemini(e.target.value)} 
            placeholder={initialGemini ? "••••••••••••••••••••" : "AIza..."} 
            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-mono focus:outline-none focus:border-teal-600 shadow-sm" 
          />
          <p className="text-[10px] text-slate-500 mt-1">Get a free key at aistudio.google.com</p>
        </div>

        {/* 4. OpenAI Key */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <label className="font-semibold text-slate-800">4. OpenAI API Key (Paid Backup)</label>
            {initialOpenai ? (
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Stored in DB
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-mono">Not Configured</span>
            )}
          </div>
          <input 
            type="password" 
            value={openaiApiKey} 
            onChange={e => setOpenai(e.target.value)} 
            placeholder={initialOpenai ? "••••••••••••••••••••" : "sk-..."} 
            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-mono focus:outline-none focus:border-teal-600 shadow-sm" 
          />
        </div>

        {/* 5. Anthropic Claude Key */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <label className="font-semibold text-slate-800">5. Anthropic Claude API Key (Paid Backup)</label>
            {initialAnthropic ? (
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Stored in DB
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-mono">Not Configured</span>
            )}
          </div>
          <input 
            type="password" 
            value={anthropicApiKey} 
            onChange={e => setAnthropic(e.target.value)} 
            placeholder={initialAnthropic ? "••••••••••••••••••••" : "sk-ant-..."} 
            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-mono focus:outline-none focus:border-teal-600 shadow-sm" 
          />
        </div>

        {error && <p className="text-rose-600 font-medium">{error}</p>}
        {success && (
          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 p-3 rounded-xl shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Keys updated &amp; saved to your database profile!
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={loading} className="w-full sm:w-auto px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50">
            {loading ? 'Saving Keys...' : 'Save AI Keys & Cascade Order'}
          </button>
        </div>
      </form>
    </div>
  );
}