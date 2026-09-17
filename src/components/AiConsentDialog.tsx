'use client';

import { Sparkles } from 'lucide-react';

// Shown once, before the first time either AI feature (Ask Wealth AI or
// the AI Statement Reader) would send any data to a third-party AI
// provider. Blocks the underlying action until the user explicitly
// allows it. See src/lib/aiConsent.ts.

export default function AiConsentDialog({
  onAllow,
  onCancel,
}: {
  onAllow: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 rounded-2xl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-sm shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Uses a third-party AI service</h3>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
          To answer a question or read a document, OmniWealth sends the relevant content &mdash; your typed
          question and a summary of your portfolio (asset names, types, and values), or the document/text
          you upload &mdash; to a third-party AI provider. By default this is <strong>Google (Gemini)</strong>;
          if you add your own API key for a different provider in Settings, your data goes to that provider
          instead.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          See{' '}
          <a
            href="/privacy#ai-processing"
            target="_blank"
            rel="noreferrer"
            className="text-teal-700 dark:text-teal-400 underline"
          >
            how we handle this in our Privacy Policy
          </a>
          . You can decline and simply not use these features.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            Not now
          </button>
          <button
            onClick={onAllow}
            className="px-4 py-1.5 bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Allow &amp; Continue
          </button>
        </div>
      </div>
    </div>
  );
}
