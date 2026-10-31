'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';

// The OmniWealth phone app opens the site root. The root is now the landing page for all the apps, so a signed-out visitor inside that
// app is sent straight to the OmniWealth page (with its Sign in button), exactly where the app used to start.
export default function NativeRootRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (Capacitor.isNativePlatform()) router.replace('/wealth');
  }, [router]);
  return null;
}
