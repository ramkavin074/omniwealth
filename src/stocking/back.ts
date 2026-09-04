'use client';

// Android hardware / gesture Back handling for the standalone Kadai APK.
//
// The app has no router — every screen is boolean state in <StockingApp> — so
// Capacitor's default Back behaviour (no history to pop, so suspend the app)
// drops the shop owner straight out of a half-finished sale on the first press.
//
// Instead we keep a small stack of handlers. The most recently mounted one runs
// first (the deepest bit of UI on screen), and only when nothing consumes the
// press do we fall through to "press Back again to exit".

type BackHandler = () => boolean; // true = press consumed

const handlers: BackHandler[] = [];

/** Register a Back handler. Returns an unregister function for effect cleanup. */
export function pushBackHandler(fn: BackHandler): () => void {
  handlers.push(fn);
  return () => {
    const i = handlers.lastIndexOf(fn);
    if (i !== -1) handlers.splice(i, 1);
  };
}

function runHandlers(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) {
    try {
      if (handlers[i]()) return true;
    } catch {
      /* a broken handler must never wedge the Back button */
    }
  }
  return false;
}

let lastBackAt = 0;
let toastEl: HTMLElement | null = null;

function flashExitHint(message: string): void {
  if (typeof document === 'undefined') return;
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.setAttribute('role', 'status');
    Object.assign(toastEl.style, {
      position: 'fixed',
      left: '50%',
      bottom: 'calc(2rem + env(safe-area-inset-bottom))',
      transform: 'translateX(-50%)',
      zIndex: '2147483647',
      padding: '0.625rem 1rem',
      borderRadius: '9999px',
      background: 'rgba(15,23,42,0.92)',
      color: '#fff',
      font: '600 0.875rem system-ui, -apple-system, sans-serif',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 150ms ease',
    });
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  toastEl.style.opacity = '1';
  window.setTimeout(() => {
    if (toastEl) toastEl.style.opacity = '0';
  }, 1400);
}

let getHint: () => string = () => 'Press Back again to exit';
let wired = false;

/**
 * Wire the Capacitor Back button to the handler stack. Native-only and
 * idempotent — safe to call from a top-level effect on every render. `hintFn`
 * supplies the (language-dependent) "press again to exit" message; a second
 * press within 2s actually exits the app.
 */
export async function initBackButton(hintFn: () => string): Promise<void> {
  getHint = hintFn;
  if (wired) return;
  const cap = (
    globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }
  ).Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  wired = true;
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', () => {
      if (runHandlers()) {
        lastBackAt = 0;
        return;
      }
      const now = Date.now();
      if (now - lastBackAt < 2000) {
        void App.exitApp();
        return;
      }
      lastBackAt = now;
      flashExitHint(getHint());
    });
  } catch {
    wired = false; // plugin not ready — let a later call retry
  }
}
