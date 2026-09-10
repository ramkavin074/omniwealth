'use client';

// Native-shell initialisation: status-bar styling, keyboard behaviour,
// dismissing the launch splash, and routing Universal Links into the WebView.
// Renders nothing. On web every branch is skipped.

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

const APP_HOSTS = new Set(['omniwealth.org', 'www.omniwealth.org']);

export default function NativeBootstrap() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];

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

      // Universal Links: a tap on an https://omniwealth.org/... link elsewhere
      // on the device opens the app here — navigate the WebView to that path.
      try {
        const { App } = await import('@capacitor/app');
        const handle = await App.addListener('appUrlOpen', ({ url }) => {
          try {
            const target = new URL(url);
            if (target.protocol !== 'https:' || !APP_HOSTS.has(target.host)) return;
            const dest = target.pathname + target.search + target.hash;
            if (dest && dest !== window.location.pathname + window.location.search + window.location.hash) {
              window.location.assign(dest);
            }
          } catch {
            /* not a URL we handle */
          }
        });
        if (cancelled) handle.remove();
        else cleanups.push(() => handle.remove());
      } catch {
        /* @capacitor/app unavailable */
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
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return null;
}
