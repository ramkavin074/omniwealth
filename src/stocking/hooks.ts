'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getLang, setLang, type Lang } from './i18n';
import { applyTheme, getTheme, setTheme, type Theme } from './theme';

export { useLiveQuery };

/** Current light/dark theme + a toggle, persisted to localStorage. */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const t = getTheme();
    setThemeState(t);
    applyTheme(t);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      setTheme(next);
      return next;
    });
  }, []);

  return { theme, toggle };
}

/** Current UI language + a toggle, persisted to localStorage. */
export function useLang(): { lang: Lang; toggle: () => void } {
  const [lang, setLangState] = useState<Lang>('ta');

  // localStorage isn't available during SSR; sync on mount.
  useEffect(() => {
    setLangState(getLang());
  }, []);

  const toggle = useCallback(() => {
    setLangState((prev) => {
      const next: Lang = prev === 'ta' ? 'en' : 'ta';
      setLang(next);
      return next;
    });
  }, []);

  return { lang, toggle };
}

/** A clock that ticks every `periodMs`, for "x minutes ago" labels. Starts at
 *  0 and corrects on mount so no impure Date.now() runs during render. */
export function useNow(periodMs = 30_000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), periodMs);
    return () => clearInterval(id);
  }, [periodMs]);
  return now;
}

/** True at the `md` breakpoint and up. */
export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return desktop;
}

/** Debounce a fast-changing value (search boxes). */
export function useDebounced<T>(value: T, ms = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
