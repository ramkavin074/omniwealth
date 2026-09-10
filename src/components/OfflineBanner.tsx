'use client';

// A slim bar that appears when the device loses connectivity. Uses
// @capacitor/network on device (fires reliably in the WebView) and falls
// back to the browser online/offline events elsewhere.

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let disposed = false;
    const set = (isOnline: boolean) => {
      if (!disposed) setOffline(!isOnline);
    };

    if (Capacitor.isNativePlatform()) {
      let remove: (() => void) | undefined;
      (async () => {
        try {
          const { Network } = await import('@capacitor/network');
          const status = await Network.getStatus();
          set(status.connected);
          const handle = await Network.addListener('networkStatusChange', (s) => set(s.connected));
          remove = () => handle.remove();
        } catch {
          /* plugin missing */
        }
      })();
      return () => {
        disposed = true;
        remove?.();
      };
    }

    set(typeof navigator === 'undefined' ? true : navigator.onLine);
    const on = () => set(true);
    const off = () => set(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      disposed = true;
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[90] flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-[12px] font-semibold text-amber-950 shadow-md"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 6px)' }}
    >
      <WifiOff className="h-3.5 w-3.5" />
      You&rsquo;re offline — showing the last loaded data.
    </div>
  );
}
