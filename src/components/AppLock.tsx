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

// A real background/return is always longer than this. The biometric
// dialog / permission dialog round-trip is a few hundred ms, so it never
// crosses the threshold — which is what stops the unlock→resume→re-lock
// loop seen on Android.
const MIN_BACKGROUND_MS = 1500;

/**
 * Native-only screen lock. On web it renders nothing. When enabled, the
 * app is covered on cold start and whenever it comes back after being
 * genuinely in the background, until the user passes biometric /
 * device-credential auth.
 */
export default function AppLock() {
  const isNative = Capacitor.isNativePlatform();
  const [locked, setLocked] = useState(isNative && lockEnabled());
  const authing = useRef(false);
  const backgroundedAt = useRef(0);

  const unlock = useCallback(async () => {
    if (authing.current) return;
    authing.current = true;
    // The auth dialog itself briefly backgrounds the app; mark it so the
    // resume handler doesn't treat the return as a new lock trigger.
    beginInternalAuth();
    try {
      console.info('[applock] authenticate…');
      await withTimeout(
        // Biometric-only (no allowDeviceCredential) → in-place BiometricPrompt,
        // no separate AuthActivity backgrounding the app.
        BiometricAuth.authenticate({
          reason: 'Unlock OmniWealth',
          cancelTitle: 'Cancel',
          androidTitle: 'OmniWealth',
          androidSubtitle: 'Verify it’s you',
          iosFallbackTitle: 'Use passcode',
        }),
      );
      console.info('[applock] unlocked');
      setLocked(false);
    } catch (err: any) {
      console.warn('[applock] auth failed:', err?.message || err?.code || String(err));
      // stay locked; the Unlock button lets the user retry
    } finally {
      endInternalAuth();
      authing.current = false;
    }
  }, []);

  const engage = useCallback(() => {
    if (!lockEnabled() || authing.current || isInternalAuth()) return;
    setLocked(true);
    void unlock();
  }, [unlock]);

  useEffect(() => {
    if (!isNative) return;

    // Cold start: lock immediately.
    engage();

    const sub = App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        backgroundedAt.current = Date.now();
        return;
      }
      // Resumed. Ignore the trivial round-trip from our own auth dialog,
      // and only lock if the app was actually away for a real interval.
      if (isInternalAuth()) return;
      if (Date.now() - backgroundedAt.current < MIN_BACKGROUND_MS) return;
      engage();
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
