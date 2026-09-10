'use client';

// Native-only. After sign-in, asks for notification permission (once), then
// registers the APNs/FCM token with the server so alerts can be delivered.
// Renders nothing; every path is a no-op on web.

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { registerPushTokenAction } from '@/actions/push';

const ASKED_KEY = 'ow.push.asked.v1';

export default function PushRegistrar({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform()) return;
    let removed = false;
    const handles: Array<{ remove: () => void }> = [];

    (async () => {
      let PushNotifications: typeof import('@capacitor/push-notifications').PushNotifications;
      try {
        ({ PushNotifications } = await import('@capacitor/push-notifications'));
      } catch {
        return;
      }

      handles.push(
        await PushNotifications.addListener('registration', (token) => {
          const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
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
