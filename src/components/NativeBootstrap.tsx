'use client';

// Native-shell initialisation: status-bar styling, keyboard behaviour and
// dismissing the launch splash once the web app has painted. Renders nothing.
// On web every branch is skipped.

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export default function NativeBootstrap() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;

    (async () => {
      // Status bar: the app chrome is dark slate, so we want light glyphs.
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        if (cancelled) return;
        await StatusBar.setStyle({ style: Style.Dark });
        if (Capacitor.getPlatform() === 'android') {
          await StatusBar.setBackgroundColor({ color: '#020617' });
        }
      } catch {
        /* plugin not present on this platform */
      }

      // Keyboard: keep the web content laid out above the keyboard and show
      // the input accessory bar (Done / prev / next).
      try {
        const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
        if (cancelled) return;
        await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
        await Keyboard.setAccessoryBarVisible({ isVisible: true });
      } catch {
        /* iOS-only / unavailable */
      }

      // The web app has mounted — drop the launch screen.
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        if (cancelled) return;
        await SplashScreen.hide();
      } catch {
        /* already hidden */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
