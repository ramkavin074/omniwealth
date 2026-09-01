'use client';

import dynamic from 'next/dynamic';

// Dexie / IndexedDB is browser-only — load the whole app client-side with no
// SSR pass.
const StockingApp = dynamic(() => import('@/stocking/StockingApp'), {
  ssr: false,
});

export default function StockingAppClient() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <StockingApp />
    </div>
  );
}
