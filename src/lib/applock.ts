export const APP_LOCK_KEY = 'omniwealth_app_lock';

export function lockEnabled(): boolean {
  try {
    return localStorage.getItem(APP_LOCK_KEY) === '1';
  } catch {
    return false;
  }
}

// While the user is deliberately running a biometric prompt from inside
// the app (the Settings toggle), the AppLock overlay must NOT also fire
// its own prompt in reaction to the app backgrounding/foregrounding for
// that dialog — two concurrent native BiometricPrompts wedge the app.
let internalAuthUntil = 0;

export function beginInternalAuth(): void {
  internalAuthUntil = Date.now() + 60_000;
}

export function endInternalAuth(): void {
  // Keep a short grace window: the appStateChange(isActive:true) event
  // arrives a beat after the prompt closes.
  internalAuthUntil = Date.now() + 3_000;
}

export function isInternalAuth(): boolean {
  return Date.now() < internalAuthUntil;
}

// Resolves/rejects the given promise, but never hangs forever — a stuck
// native callback would otherwise pin the "auth in progress" guard.
export function withTimeout<T>(p: Promise<T>, ms = 45_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('biometric-timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
