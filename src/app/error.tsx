'use client';

import { useEffect } from 'react';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[route-error]', error?.message, error?.digest, error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-6 text-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <h1 className="text-lg font-bold">Something went wrong loading this page</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
        This is usually a temporary network hiccup. Try again in a moment.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm rounded-xl transition-colors"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.assign(window.location.origin)}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm rounded-xl transition-colors"
        >
          Reload app
        </button>
      </div>
      {error?.digest && (
        <p className="text-[10px] font-mono text-slate-400 dark:text-slate-600">ref: {error.digest}</p>
      )}
    </div>
  );
}
