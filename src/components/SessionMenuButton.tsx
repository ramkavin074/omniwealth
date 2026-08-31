'use client';

import { useEffect, useState } from 'react';
import { LogOut, Lock } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { logoutAction } from '@/actions/auth';
import { lockNow } from '@/components/AppLock';
import { APP_LOCK_KEY } from '@/lib/applock';

const FULL_CLS =
  'w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-sm font-semibold rounded-xl border border-rose-200 dark:border-rose-900 cursor-pointer transition';
const ICON_CLS =
  'p-2 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-900 transition cursor-pointer shadow-sm flex items-center justify-center';

/**
 * Menu action for ending a session. When native app lock is enabled it
 * becomes "Lock now" (re-arms the biometric gate, stays signed in);
 * otherwise it's a full "Logout". True sign-out with app lock on lives
 * in Household Settings → Security.
 */
export default function SessionMenuButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const [lockMode, setLockMode] = useState(false);

  useEffect(() => {
    try {
      setLockMode(
        Capacitor.isNativePlatform() && localStorage.getItem(APP_LOCK_KEY) === '1',
      );
    } catch {
      /* ignore */
    }
  }, []);

  if (lockMode) {
    return (
      <button
        type="button"
        onClick={lockNow}
        title="Lock now"
        className={iconOnly ? ICON_CLS : FULL_CLS}
      >
        <Lock className="w-4 h-4" /> {!iconOnly && 'Lock now'}
      </button>
    );
  }

  return (
    <form action={logoutAction} className={iconOnly ? '' : 'pt-1'}>
      <button type="submit" title="Logout" className={iconOnly ? ICON_CLS : FULL_CLS}>
        <LogOut className="w-4 h-4" /> {!iconOnly && 'Logout'}
      </button>
    </form>
  );
}
