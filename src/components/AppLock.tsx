'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { Lock } from 'lucide-react';
import {
  APP_LOCK_KEY,
  lockEnabled,
  beginInternalAuth,
  endInternalAuth,
  isInternalAuth,
  withTimeout,
} from '@/lib/applock';

export { APP_LOCK_KEY };

/**
 * Native-only screen lock. On web it renders nothing. When enabled, the
 * app is covered on cold start and whenever it returns from the
 * background until the user passes biometric / device-credential auth.
 */
export default function AppLock() {
  const isNative = Capacitor.isNativePlatform();
  const [locked, setLocked] = useState(isNative && lockEnabled());
  const authing = useRef(false);
  const unlockedAt = useRef(0);

  const unlock = useCallback(async () => {
    if (authing.current) return;
    authing.current = true;
    // The plugin's auth dialog / AuthActivity backgrounds then foregrounds
    // the app. Mark that as an internal auth so the appStateChange handler
    // below doesn't treat the return as a fresh "re-lock and prompt again".
    beginInternalAuth();
    try {
      console.info('[applock] unlock authenticate…');
      await withTimeout(
        BiometricAuth.authenticate({
          reason: 'Unlock OmniWealth',
          cancelTitle: 'Cancel',
          allowDeviceCredential: true,
          androidTitle: 'OmniWealth',
          androidSubtitle: 'Verify it’s you',
          iosFallbackTitle: 'Use passcode',
        }),
      );
      console.info('[applock] unlock ok');
      unlockedAt.current = Date.now();
      setLocked(false);
    } catch (err: any) {
      console.warn('[applock] unlock failed:', err?.message || err?.code || String(err), err);
      // stay locked; the Unlock button lets the user retry
    } finally {
      endInternalAuth();
      authing.current = false;
    }
  }, []);

  // Lock + prompt on cold start / return-from-background. Skips while an
  // internal auth is running (settings toggle, or our own prompt above)
  // and for a few seconds after a successful unlock, so the trailing
  // foreground event doesn't immediately re-lock.
  const engage = useCallback(() => {
    if (!lockEnabled()) return;
    if (authing.current || isInternalAuth()) return;
    if (Date.now() - unlockedAt.current < 3000) return;
    setLocked(true);
    void unlock();
  }, [unlock]);

  useEffect(() => {
    if (!isNative) return;

    engage();

    const sub = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) engage();
    });
    return () => {
      void sub.then((h) => h.remove());
    };
  }, [isNative, engage]);

  if (!isNative || !locked) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center gap-6 text-slate-100">
      <div className="p-4 bg-teal-700 rounded-2xl shadow-lg shadow-teal-900/40">
        <Lock className="w-8 h-8 text-white" />
      </div>
      <p className="text-sm text-slate-400">OmniWealth is locked</p>
      <button
        onClick={() => void unlock()}
        className="px-5 py-2.5 bg-teal-700 hover:bg-teal-600 text-white font-semibold text-sm rounded-xl transition-colors"
      >
        Unlock
      </button>
    </div>
  );
}
