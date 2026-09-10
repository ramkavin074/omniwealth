// Pushes the current net worth into the iOS Home Screen widget's shared
// App Group container. No-op on web / Android and if the native plugin
// (WidgetBridge.swift) or the App Group isn't wired up yet.

import { Capacitor, registerPlugin } from '@capacitor/core';

interface WidgetBridgePlugin {
  setNetWorth(options: { amount: number; currency: string }): Promise<void>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

let lastPushed = '';

export async function pushNetWorthToWidget(amount: number, currency: string): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return;
  if (!Number.isFinite(amount) || !currency) return;

  // Avoid hammering WidgetKit on every re-render.
  const sig = `${Math.round(amount)}|${currency}`;
  if (sig === lastPushed) return;
  lastPushed = sig;

  try {
    await WidgetBridge.setNetWorth({ amount, currency });
  } catch {
    /* plugin/app-group not present */
  }
}
