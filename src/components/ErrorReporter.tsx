'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { reportClientError, setReportedAppVersion } from '@/lib/clientErrorReport';

/** Mounts once in the root layout; renders nothing. */
export default function ErrorReporter() {
  useEffect(() => {
    const onError = (ev: ErrorEvent) => reportClientError('error', ev.error ?? ev.message);
    const onRejection = (ev: PromiseRejectionEvent) => reportClientError('unhandledrejection', ev.reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    // Native builds: include the build number so reports can be tied to a release.
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app')
        .then(({ App }) => App.getInfo())
        .then((info) => setReportedAppVersion(info.build))
        .catch(() => {});
    }
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
