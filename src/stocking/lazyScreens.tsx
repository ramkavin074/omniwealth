'use client';

// Resilient lazy loading for the occasional screens.
//
// On the website, screens load as separate files. If the site is updated while
// someone has the page open, the old page asks for files that no longer exist and
// the tap on e.g. "Reports" silently does nothing. So: retry once, then reload
// once to pick up the new version (guarded so it can never loop), and if it
// still fails, show a message with a way back instead of a dead screen. The
// bundled apps load these from disk, so for them this never triggers.

import { Component, lazy, type ComponentType, type ReactNode } from 'react';
import { getLang, t } from './i18n';

const RELOADED_KEY = 'kadai.chunkReloaded';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- must accept any screen's props, like React.lazy
export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      try {
        sessionStorage.removeItem(RELOADED_KEY);
      } catch {
        /* ignore */
      }
      return mod;
    } catch {
      try {
        return await factory();
      } catch (e) {
        if (typeof window !== 'undefined') {
          try {
            if (!sessionStorage.getItem(RELOADED_KEY)) {
              sessionStorage.setItem(RELOADED_KEY, '1');
              window.location.reload();
              return await new Promise<never>(() => {}); // page is reloading
            }
          } catch {
            /* storage unavailable: fall through to the error message */
          }
        }
        throw e;
      }
    }
  });
}

interface Props {
  children: ReactNode;
  /** Close any open screen and go to Home. */
  onHome: () => void;
}

export class ScreenBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const lang = getLang();
    return (
      <div className="space-y-4 p-8 text-center text-slate-700 dark:text-slate-200">
        <p>{t(lang, 'err.screenLoad')}</p>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-11 rounded-lg bg-teal-700 px-5 font-semibold text-white"
          >
            {t(lang, 'err.reload')}
          </button>
          <button
            type="button"
            onClick={() => {
              this.setState({ failed: false });
              this.props.onHome();
            }}
            className="h-11 rounded-lg bg-slate-200 px-5 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
          >
            {t(lang, 'tab.home')}
          </button>
        </div>
      </div>
    );
  }
}
