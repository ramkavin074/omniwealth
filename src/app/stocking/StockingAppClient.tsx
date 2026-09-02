'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dexie / IndexedDB is browser-only — load the whole app client-side with no
// SSR pass.
const StockingApp = dynamic(() => import('@/stocking/StockingApp'), {
  ssr: false,
});

interface Props {
  userId: string;
  displayName: string;
  store: { id: string; name: string; role: 'owner' | 'manager' | 'staff' };
}

/**
 * In-OmniWealth host. There's no LoginGate here (the page is gated
 * server-side), so we seed the same `stocking.auth` blob the standalone app's
 * LoginGate writes — minus the bearer token, since this host syncs on the
 * session cookie.
 */
export default function StockingAppClient({ userId, displayName, store }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const prev = JSON.parse(localStorage.getItem('stocking.auth') || '{}');
      localStorage.setItem(
        'stocking.auth',
        JSON.stringify({
          ...prev,
          userId,
          displayName,
          storeId: store.id,
          role: store.role,
          stores: [store],
          savedAt: Date.now(),
        }),
      );
    } catch {
      /* storage unavailable — the app still works, just without role gating */
    }
    setReady(true);
  }, [userId, displayName, store]);

  if (!ready) return null;

  return (
    <div className="kadai min-h-screen bg-slate-50 dark:bg-slate-950">
      <StockingApp />
    </div>
  );
}
