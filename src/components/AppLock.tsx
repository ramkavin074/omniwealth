'use client';

import { useEffect, useState } from 'react';
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

// A genuine background/return is always longer than this; the biometric
// dialog's own round-trip is a few hundred ms, so it never crosses the
// threshold — which is what stops the unlock→resume→re-lock loop.
const MIN_BACKGROUND_MS = 1500;

/*
 * Module-scoped controller. It lives outside React so it survives the
 * component remounting on route changes / layout re-renders (e.g. the
 * logout → redirect-to-/login navigation). That means:
 *   - the appStateChange listener is attached exactly once,
 *   - an unlocked session stays unlocked across remounts,
 *   - there's never a second, competing biometric prompt.
 */
let started = false;
let locked = false;
let authing = false;
let backgroundedAt = 0;
let lastError = '';
const subscribers = new Set<() => void>();

function publish() {
  subscribers.forEach((fn) => fn());
}

async function runAuth() {
  if (authing) return;
  authing = true;
  lastError = '';
  publish();
  // The auth dialog briefly backgrounds the app; mark it so the resume
  // handler doesn't treat the return as a fresh lock trigger.
  beginInternalAuth();
  try {
    console.info('[applock] authenticate…');
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
    console.info('[applock] unlocked');
    locked = false;
    publish();
  } catch (err: any) {
    lastError = err?.message || err?.code || String(err);
    console.warn('[applock] auth failed:', lastError);
    // stay locked; the Unlock button retries
    publish();
  } finally {
    endInternalAuth();
    authing = false;
    publish();
  }
}

function engage() {
  if (!lockEnabled() || authing || isInternalAuth()) return;
  locked = true;
  publish();
  void runAuth();
}

function startController() {
  if (started || !Capacitor.isNativePlatform()) return;
  started = true;

  if (lockEnabled()) {
    locked = true;
    publish();
    void runAuth();
  }

  void App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      backgroundedAt = Date.now();
      return;
    }
    if (isInternalAuth()) return;
    if (Date.now() - backgroundedAt < MIN_BACKGROUND_MS) return;
    engage();
  });
}

export function retryUnlock() {
  void runAuth();
}

// Re-arm the lock without signing out — used by the "Lock now" menu
// action when app lock is enabled.
export function lockNow() {
  if (!Capacitor.isNativePlatform()) return;
  lastError = '';
  locked = true;
  publish();
}

/**
 * Native-only screen lock. On web it renders nothing.
 */
export default function AppLock() {
  const isNative = Capacitor.isNativePlatform();
  const [, force] = useState(0);

  useEffect(() => {
    if (!isNative) return;
    startController();
    const fn = () => force((n) => n + 1);
    subscribers.add(fn);
    fn(); // sync with whatever the controller already decided
    return () => {
      subscribers.delete(fn);
    };
  }, [isNative]);

  if (!isNative || !locked) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center gap-5 text-slate-100 px-8 text-center">
      <div className="p-4 bg-teal-700 rounded-2xl shadow-lg shadow-teal-900/40">
        <Lock className="w-8 h-8 text-white" />
      </div>
      <p className="text-sm text-slate-400">OmniWealth is locked</p>
      <button
        onClick={retryUnlock}
        disabled={authing}
        className="px-5 py-2.5 bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors"
      >
        {authing ? 'Verifying…' : 'Unlock'}
      </button>
      {lastError && (
        <p className="text-[11px] font-mono text-rose-400 max-w-xs break-words">{lastError}</p>
      )}
    </div>
  );
}
