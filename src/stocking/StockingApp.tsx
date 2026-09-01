'use client';

import { useState } from 'react';
import { t } from './i18n';
import { useLang } from './hooks';
import HomeScreen from './screens/HomeScreen';
import ScanScreen from './screens/ScanScreen';
import AdjustScreen from './screens/AdjustScreen';
import ProductListScreen from './screens/ProductListScreen';
import SettingsSheet from './screens/SettingsSheet';

type Tab = 'home' | 'scan' | 'adjust' | 'products';

const TABS: Tab[] = ['home', 'scan', 'adjust', 'products'];

export default function StockingApp() {
  const { lang, toggle } = useLang();
  const [tab, setTab] = useState<Tab>('home');
  const [lowOnly, setLowOnly] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <header
        className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50">
          {t(lang, 'app.title')}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="rounded-lg bg-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200"
          >
            {t(lang, 'lang.toggle')}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label={t(lang, 'settings.title')}
            className="rounded-lg bg-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200"
          >
            ⚙
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'home' && (
          <HomeScreen
            lang={lang}
            onOpenLow={() => {
              setLowOnly(true);
              setTab('products');
            }}
          />
        )}
        {tab === 'scan' && <ScanScreen lang={lang} />}
        {tab === 'adjust' && <AdjustScreen lang={lang} />}
        {tab === 'products' && (
          <ProductListScreen
            lang={lang}
            lowOnly={lowOnly}
            onLowOnlyChange={setLowOnly}
          />
        )}
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

      {settingsOpen && (
        <SettingsSheet lang={lang} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
