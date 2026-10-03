'use client';

import { useState, useSyncExternalStore } from 'react';
import { Share2 } from 'lucide-react';
import { haptic, isNativeApp, nativeShare } from '@/lib/native';

const noopSubscribe = () => () => {};
const canShareNow = () =>
  isNativeApp() || (typeof navigator !== 'undefined' && typeof navigator.share === 'function');

/**
 * A small "Share" control that shows exactly what will be sent before the
 * system share sheet opens. Callers pass percentage-only text — never account
 * names, numbers or balances — so a one-tap share can't leak holdings.
 * Renders nothing where sharing isn't available (e.g. desktop browsers).
 */
export default function ShareTextButton({
  getText,
  title,
  dialogTitle,
  label = 'Share',
}: {
  getText: () => string;
  title: string;
  dialogTitle: string;
  label?: string;
}) {
  const canShare = useSyncExternalStore(noopSubscribe, canShareNow, () => false);
  const [preview, setPreview] = useState<string | null>(null);

  if (!canShare) return null;

  const openPreview = () => {
    void haptic('light');
    setPreview(getText());
  };

  const send = async () => {
    if (preview == null) return;
    const text = preview;
    setPreview(null);
    await nativeShare({ title, text, dialogTitle });
  };

  return (
    <div className="relative inline-block print:hidden">
      <button
        type="button"
        onClick={() => (preview == null ? openPreview() : setPreview(null))}
        aria-expanded={preview != null}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
      >
        <Share2 className="w-3.5 h-3.5" />
        {label}
      </button>

      {preview != null && (
        <div
          role="dialog"
          aria-label="Share preview"
          className="absolute right-0 top-full mt-2 z-30 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-xl"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            This will be shared
          </p>
          <pre className="mt-1.5 whitespace-pre-wrap break-words font-sans text-xs text-slate-800 dark:text-slate-200">
            {preview}
          </pre>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={send}
              className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold cursor-pointer"
            >
              Share
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
