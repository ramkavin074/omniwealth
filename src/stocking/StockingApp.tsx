'use client';

import { useState } from 'react';
import { t } from './i18n';
import { useLang } from './hooks';
import ScanScreen from './screens/ScanScreen';
import AdjustScreen from './screens/AdjustScreen';
import ProductListScreen from './screens/ProductListScreen';

type Tab = 'scan' | 'adjust' | 'products';

const TABS: Tab[] = ['scan', 'adjust', 'products'];

export default function StockingApp() {
  const { lang, toggle } = useLang();
  const [tab, setTab] = useState<Tab>('scan');

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-slate-50 dark:bg-slate-950">
      <header
        className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50">
          {t(lang, 'app.title')}
        </h1>
        <button
          type="button"
          onClick={toggle}
          className="rounded-lg bg-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200"
        >
          {t(lang, 'lang.toggle')}
        </button>
      </header>

      {/* Bottom padding clears the fixed nav (≈3.25rem) plus the OS gesture
          bar (safe-area inset) so a screen's last button is never hidden. */}
      <main
        className="flex-1 overflow-y-auto"
        style={{
          paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))',
        }}
      >
        {tab === 'scan' && <ScanScreen lang={lang} />}
        {tab === 'adjust' && <AdjustScreen lang={lang} />}
        {tab === 'products' && <ProductListScreen lang={lang} />}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            className={`flex-1 py-3 text-sm font-semibold transition ${
              tab === name
                ? 'text-teal-700 dark:text-teal-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {t(lang, `tab.${name}`)}
          </button>
        ))}
      </nav>
    </div>
  );
}
