// Pushes the current net worth into the Home Screen widget: the iOS App Group
// container (WidgetBridge.swift) or Android SharedPreferences
// (WidgetBridgePlugin.java). No-op on web, and if the native plugin isn't in
// the installed build.

import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { reportClientError } from '@/lib/clientErrorReport';
import { createWidgetKeyAction } from '@/actions/widgetKeys';

interface WidgetBridgePlugin {
  setNetWorth(options: { amount: number; currency: string; hidden?: boolean }): Promise<void>;
  clear(): Promise<void>;
  /** Background refresh: store the read-only key on the device. */
  setKey(options: { key: string }): Promise<void>;
  getKeyInfo(): Promise<{ hasKey: boolean; ageDays: number }>;
  /** Hide/show the balance without needing a new number. */
  setHidden(options: { hidden: boolean }): Promise<void>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

// Widget privacy: by default the widget shows dots and asks for a fingerprint /
// face / PIN when tapped, then reveals the number briefly. "Always show" skips that.
const SHOW_KEY = 'omniwealth_widget_show_always';

/** True when the user chose to always show the balance on the widget. */
export function widgetShowAlwaysPref(): boolean {
  try {
    return localStorage.getItem(SHOW_KEY) === '1';
  } catch {
    return false;
  }
}

export function setWidgetShowAlwaysPref(show: boolean): void {
  try {
    if (show) localStorage.setItem(SHOW_KEY, '1');
    else localStorage.removeItem(SHOW_KEY);
  } catch {
    /* ignore */
  }
}

const supported = () => {
  if (!Capacitor.isNativePlatform()) return false;
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android';
};

// Tap-to-unlock arrived in Android build 27. Older Android builds can only show
// "Balance hidden" with no way to reveal it, so they keep showing the number
// (a tap opens the app) until the user updates. iOS widgets are unaffected.
const ANDROID_TAP_UNLOCK_BUILD = 27;
let tapUnlockSupported: boolean | null = null;

async function nativeSupportsTapUnlock(): Promise<boolean> {
  if (tapUnlockSupported !== null) return tapUnlockSupported;
  if (Capacitor.getPlatform() !== 'android') return (tapUnlockSupported = true);
  try {
    const info = await App.getInfo();
    tapUnlockSupported = Number(info.build) >= ANDROID_TAP_UNLOCK_BUILD;
  } catch {
    tapUnlockSupported = false;
  }
  return tapUnlockSupported;
}

let lastPushed = '';

export async function pushNetWorthToWidget(amount: number, currency: string): Promise<void> {
  if (!supported()) return;
  if (!Number.isFinite(amount) || !currency) return;

  // "hidden" = locked: dots until the user unlocks it with a tap (unless they chose always-show).
  const hidden = (await nativeSupportsTapUnlock()) && !widgetShowAlwaysPref();

  // Avoid hammering the widget on every re-render.
  const sig = `${Math.round(amount)}|${currency}|${hidden ? 1 : 0}`;
  if (sig === lastPushed) return;
  lastPushed = sig;

  try {
    await WidgetBridge.setNetWorth({ amount, currency, hidden });
    void ensureWidgetKey();
  } catch (err) {
    // Expected when the installed app build has no widget plugin (older builds);
    // anything else is worth knowing about, so it goes to the error log.
    const msg = String((err as { message?: unknown })?.message ?? err);
    if (!/not implemented|unimplemented|not available|App Group/i.test(msg)) {
      reportClientError('error', new Error(`widget setNetWorth failed: ${msg}`));
    } else {
      reportClientError('error', new Error(`widget plugin unavailable: ${msg}`));
    }
  }
}

const KEY_ROTATE_DAYS = 30;
let keyChecked = false;

/**
 * Make sure this phone holds a fresh read-only widget key, so the widget can
 * refresh its number in the background. Safe to call often: it does nothing
 * unless there is no key yet or the key is older than 30 days. Silent on old
 * app builds that don't have the native support.
 */
export async function ensureWidgetKey(): Promise<void> {
  if (!supported() || keyChecked) return;
  keyChecked = true;
  try {
    const info = await WidgetBridge.getKeyInfo();
    if (info.hasKey && info.ageDays < KEY_ROTATE_DAYS) return;
    const res = await createWidgetKeyAction(Capacitor.getPlatform());
    if (res.success) await WidgetBridge.setKey({ key: res.key });
  } catch {
    /* older build without background refresh, or offline: try next launch */
    keyChecked = false;
  }
}

/** Tell the widget its lock state changed (the Settings switch): hidden = needs unlock. */
export async function setWidgetHidden(hidden: boolean): Promise<void> {
  if (!supported()) return;
  try {
    await WidgetBridge.setHidden({ hidden: hidden && (await nativeSupportsTapUnlock()) });
  } catch {
    /* older build */
  }
}

/** Remove the stored balance (called on sign-out). */
export async function clearWidget(): Promise<void> {
  if (!supported()) return;
  lastPushed = '';
  try {
    await WidgetBridge.clear();
  } catch {
    /* older build without the plugin / iOS without clear() */
  }
}
