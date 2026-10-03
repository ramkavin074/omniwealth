'use client';

// Native-only. After sign-in, asks for notification permission (once), then
// registers the APNs/FCM token with the server so alerts can be delivered.
// Renders nothing; every path is a no-op on web.

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { registerPushTokenAction } from '@/actions/push';

const ASKED_KEY = 'ow.push.asked.v1';

// First Android build (versionCode) that ships google-services.json. Older
// Android builds have no Firebase config, and register() there throws
// "FirebaseApp is not initialized" and crashes the app — and because this app
// loads the live site, this code reaches those old builds too, so gate on it.
const ANDROID_MIN_PUSH_BUILD = 23;

async function pushSupported(): Promise<'ios' | 'android' | null> {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return 'ios';
  if (platform !== 'android') return null;
  try {
    const info = await App.getInfo();
    return Number(info.build) >= ANDROID_MIN_PUSH_BUILD ? 'android' : null;
  } catch {
    return null;
  }
}

export default function PushRegistrar({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    let removed = false;
    const handles: Array<{ remove: () => void }> = [];

    (async () => {
      const platform = await pushSupported();
      if (!platform || removed) return;
      let PushNotifications: typeof import('@capacitor/push-notifications').PushNotifications;
      try {
        ({ PushNotifications } = await import('@capacitor/push-notifications'));
      } catch {
        return;
      }

      handles.push(
        await PushNotifications.addListener('registration', (token) => {
          void registerPushTokenAction(token.value, platform);
        }),
      );
      handles.push(
        await PushNotifications.addListener('registrationError', (err) => {
          console.warn('[push] registration error', err);
        }),
      );

      try {
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
          // Only prompt once per install; the user can re-enable in Settings.
          if (typeof localStorage !== 'undefined' && localStorage.getItem(ASKED_KEY)) return;
          try {
            localStorage.setItem(ASKED_KEY, '1');
          } catch {
            /* private mode */
          }
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive === 'granted' && !removed) {
          await PushNotifications.register();
        }
      } catch (e) {
        console.warn('[push] setup failed', e);
      }
    })();

    return () => {
      removed = true;
      handles.forEach((h) => h.remove());
    };
  }, [enabled]);

  return null;
}
