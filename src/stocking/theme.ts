'use client';

// Light / dark theme for the stocking app. Uses the SAME `localStorage['theme']`
// key and `.dark` class on <html> that the OmniWealth shell uses, so when the
// module runs inside OmniWealth the two stay in sync; in the standalone APK it
// is self-contained.

export type Theme = 'light' | 'dark';

const KEY = 'theme';

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage blocked */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b1220' : '#f8fafc');
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage blocked */
  }
  applyTheme(theme);
}
