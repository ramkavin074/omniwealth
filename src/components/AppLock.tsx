'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { Lock } from 'lucide-react';

export const APP_LOCK_KEY = 'omniwealth_app_lock';

function lockEnabled(): boolean {
  try {
    return localStorage.getItem(APP_LOCK_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Native-only screen lock. On web it renders nothing. When enabled, the
 * app is covered on cold start and whenever it returns from the
 * background until the user passes biometric / device-credential auth.
 */
export default function AppLock() {
  const isNative = Capacitor.isNativePlatform();
  const [locked, setLocked] = useState(isNative && lockEnabled());
  const authing = useRef(false);

  const unlock = useCallback(async () => {
    if (authing.current) return;
    authing.current = true;
    try {
      await BiometricAuth.authenticate({
        reason: 'Unlock OmniWealth',
        cancelTitle: 'Cancel',
        allowDeviceCredential: true,
        androidTitle: 'OmniWealth',
        androidSubtitle: 'Verify it\u2019s you',
        iosFallbackTitle: 'Use passcode',
      });
      setLocked(false);
    } catch {
      // stay locked; user can retry
    } finally {
      authing.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isNative) return;

    if (lockEnabled()) {
      setLocked(true);
      void unlock();
    }

    const sub = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        if (lockEnabled()) {
          setLocked(true);
          void unlock();
        }
      }
    });
    return () => {
      void sub.then((h) => h.remove());
    };
  }, [isNative, unlock]);

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
