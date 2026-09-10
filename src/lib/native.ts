// Thin, dependency-light wrappers around the native-only Capacitor plugins.
// Every call is a no-op (or a sensible web fallback) off-device, and each
// plugin is imported dynamically so the web bundle never pulls in native code
// it can't run.

import { Capacitor } from '@capacitor/core';

export const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

type ImpactStyle = 'light' | 'medium' | 'heavy';
type NotifyStyle = 'success' | 'warning' | 'error';

/** Haptic feedback. Silently does nothing on web or if the taptic engine is unavailable. */
export async function haptic(kind: ImpactStyle | NotifyStyle = 'light'): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
    if (kind === 'success' || kind === 'warning' || kind === 'error') {
      const map = {
        success: NotificationType.Success,
        warning: NotificationType.Warning,
        error: NotificationType.Error,
      } as const;
      await Haptics.notification({ type: map[kind] });
    } else {
      const map = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      } as const;
      await Haptics.impact({ style: map[kind] });
    }
  } catch {
    /* no-op */
  }
}

export interface SharePayload {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}

/**
 * Native share sheet on device; Web Share API on a supporting browser;
 * returns false when nothing could handle it (caller can fall back to copy).
 */
export async function nativeShare(payload: SharePayload): Promise<boolean> {
  if (isNativeApp()) {
    try {
      const { Share } = await import('@capacitor/share');
      const { value } = await Share.canShare();
      if (!value) return false;
      await Share.share(payload);
      return true;
    } catch {
      return false;
    }
  }
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
