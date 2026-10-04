// Pushes the current net worth into the Home Screen widget: the iOS App Group
// container (WidgetBridge.swift) or Android SharedPreferences
// (WidgetBridgePlugin.java). No-op on web, and if the native plugin isn't in
// the installed build.

import { Capacitor, registerPlugin } from '@capacitor/core';
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

const HIDE_KEY = 'omniwealth_widget_hide';

/** True when the user asked the widget to hide the balance (default: show it). */
export function widgetHidePref(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setWidgetHidePref(hide: boolean): void {
  try {
    if (hide) localStorage.setItem(HIDE_KEY, '1');
    else localStorage.removeItem(HIDE_KEY);
  } catch {
    /* ignore */
  }
}

const supported = () => {
  if (!Capacitor.isNativePlatform()) return false;
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android';
};

let lastPushed = '';

export async function pushNetWorthToWidget(amount: number, currency: string): Promise<void> {
  if (!supported()) return;
  if (!Number.isFinite(amount) || !currency) return;

  // The widget shows the balance unless the user chose to hide it (Settings).
  const hidden = widgetHidePref();

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

/** Tell the widget to hide/show the balance right away (the Settings switch). */
export async function setWidgetHidden(hidden: boolean): Promise<void> {
  if (!supported()) return;
  try {
    await WidgetBridge.setHidden({ hidden });
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
