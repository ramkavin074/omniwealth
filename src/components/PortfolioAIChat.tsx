'use client';

import { useState } from 'react';
import { askPortfolioAIAction } from '@/actions/ai-actions';
import { Send, Sparkles, X, Cpu } from 'lucide-react';

export default function PortfolioAIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [messages, setMessages] = useState<{ sender: 'user' | 'ai'; text: string; provider?: string }[]>([
    { sender: 'ai', text: "Hello! I'm your family wealth assistant. Ask me anything about our net worth, assets, or retirement plans.", provider: 'System' }
  ]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    const userText = prompt.trim();
    setPrompt('');
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setLoading(true);

    const res = await askPortfolioAIAction(userText, selectedModel);
    setLoading(false);

    if (res.success) {
      setMessages(prev => [...prev, { sender: 'ai', text: res.answer || 'No response generated.', provider: res.providerUsed }]);
    } else {
      setMessages(prev => [...prev, { sender: 'ai', text: `Error: ${res.error}`, provider: 'Error' }]);
    }
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-full shadow-2xl flex items-center gap-2 z-50 transition-transform hover:scale-105"
      >
        <Sparkles className="w-5 h-5 text-indigo-200" />
        <span className="text-xs font-bold hidden sm:inline">Ask Wealth AI</span>
      </button>

      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 max-w-[90vw] h-[520px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden">
          {/* Header with Model Selector */}
          <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Wealth AI</span>
            </div>
            
            <div className="flex items-center gap-2">
              <select 
                value={selectedModel} 
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] rounded-lg px-2 py-1 focus:outline-none"
              >
                <option value="auto">Auto (Free-First Cascade)</option>
                <option value="groq">Groq (Llama 3.3)</option>
                <option value="openrouter">OpenRouter (Free)</option>
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI (GPT-4o-mini)</option>
                <option value="anthropic">Anthropic Claude</option>
              </select>
              
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl leading-relaxed whitespace-pre-line ${
                  m.sender === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none' 
                    : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none'
                }`}>
                  {m.text}
                </div>
                {m.provider && m.sender === 'ai' && (
                  <span className="text-[9px] text-slate-500 mt-1 px-1 flex items-center gap-1">
                    <Cpu className="w-2.5 h-2.5" /> via {m.provider}
                  </span>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-950 border border-slate-800 text-slate-400 p-3 rounded-2xl animate-pulse text-xs">
                  Analyzing via {selectedModel === 'auto' ? 'Free-First Cascade' : selectedModel}...
                </div>
              </div>
            )}
          </div>

          {/* Footer Input */}
          <form onSubmit={handleSend} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
            <input 
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask about assets, retirement, etc..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-xl">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}