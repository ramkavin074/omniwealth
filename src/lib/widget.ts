// Pushes the current net worth into the Home Screen widget: the iOS App Group
// container (WidgetBridge.swift) or Android SharedPreferences
// (WidgetBridgePlugin.java). No-op on web, and if the native plugin isn't in
// the installed build.

import { Capacitor, registerPlugin } from '@capacitor/core';
import { lockEnabled } from '@/lib/applock';

interface WidgetBridgePlugin {
  setNetWorth(options: { amount: number; currency: string; hidden?: boolean }): Promise<void>;
  clear(): Promise<void>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

const supported = () => {
  if (!Capacitor.isNativePlatform()) return false;
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android';
};

let lastPushed = '';

export async function pushNetWorthToWidget(amount: number, currency: string): Promise<void> {
  if (!supported()) return;
  if (!Number.isFinite(amount) || !currency) return;

  // With app lock on, keep the balance off the Home Screen (the widget shows
  // a masked placeholder instead). Both platforms honour this (iOS needs build 1.22+).
  const hidden = lockEnabled();

  // Avoid hammering the widget on every re-render.
  const sig = `${Math.round(amount)}|${currency}|${hidden ? 1 : 0}`;
  if (sig === lastPushed) return;
  lastPushed = sig;

  try {
    await WidgetBridge.setNetWorth({ amount, currency, hidden });
  } catch {
    /* plugin/app-group not present */
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
