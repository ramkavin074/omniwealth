'use client';

import { useEffect, useState } from 'react';
import { t } from './i18n';
import { useLang } from './hooks';
import { maybeAutoSync } from './sync';
import HomeScreen from './screens/HomeScreen';
import ScanScreen from './screens/ScanScreen';
import AdjustScreen from './screens/AdjustScreen';
import ProductListScreen from './screens/ProductListScreen';
import SettingsSheet from './screens/SettingsSheet';
import SuppliersScreen from './screens/SuppliersScreen';
import ReportsScreen from './screens/ReportsScreen';
import AuditScreen from './screens/AuditScreen';
import AskAiSheet from './screens/AskAiSheet';
import ScanDocScreen from './screens/ScanDocScreen';

type Tab = 'home' | 'scan' | 'adjust' | 'products';

const TABS: Tab[] = ['home', 'scan', 'adjust', 'products'];

export default function StockingApp() {
  const { lang, toggle } = useLang();
  const [tab, setTab] = useState<Tab>('home');
  const [lowOnly, setLowOnly] = useState(false);
  const [expOnly, setExpOnly] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [suppliersOpen, setSuppliersOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [askAiOpen, setAskAiOpen] = useState(false);
  const [scanDoc, setScanDoc] = useState<null | 'invoice' | 'payment'>(null);

  // Opportunistic sync on open; also whenever the device comes back online.
  useEffect(() => {
    maybeAutoSync();
    const onOnline = () => maybeAutoSync();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 md:max-w-4xl md:border-x md:border-slate-200 md:dark:border-slate-800">
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
            onClick={() => setAskAiOpen(true)}
            aria-label={t(lang, 'ai.ask')}
            className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white"
          >
            {t(lang, 'ai.ask')}
          </button>
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

      {/* Bottom tab bar on phones (fixed, out of flow); a top tab strip on
          desktop (static, sits here between header and content). */}
      <nav
        className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:static md:max-w-none md:border-t-0 md:border-b"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            className={`flex-1 py-3 text-sm font-semibold transition md:flex-none md:px-5 ${
              tab === name
                ? 'text-teal-700 dark:text-teal-400 md:border-b-2 md:border-teal-700'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {t(lang, `tab.${name}`)}
          </button>
        ))}
      </nav>

      <main className="flex-1 min-h-0 overflow-y-auto">
        {scanDoc ? (
          <ScanDocScreen
            lang={lang}
            kind={scanDoc}
            onClose={() => setScanDoc(null)}
          />
        ) : suppliersOpen ? (
          <SuppliersScreen
            lang={lang}
            onClose={() => setSuppliersOpen(false)}
            onScanPayment={() => {
              setSuppliersOpen(false);
              setScanDoc('payment');
            }}
          />
        ) : reportsOpen ? (
          <ReportsScreen lang={lang} onClose={() => setReportsOpen(false)} />
        ) : auditOpen ? (
          <AuditScreen lang={lang} onClose={() => setAuditOpen(false)} />
        ) : (
          <>
            {tab === 'home' && (
              <HomeScreen
                lang={lang}
                onOpenLow={() => {
                  setLowOnly(true);
                  setExpOnly(false);
                  setTab('products');
                }}
                onOpenExpiring={() => {
                  setExpOnly(true);
                  setLowOnly(false);
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
                expOnly={expOnly}
                onExpOnlyChange={setExpOnly}
                onScanInvoice={() => setScanDoc('invoice')}
              />
            )}
          </>
        )}
      </main>

      {settingsOpen && (
        <SettingsSheet
          lang={lang}
          onClose={() => setSettingsOpen(false)}
          onOpenSuppliers={() => {
            setSettingsOpen(false);
            setSuppliersOpen(true);
          }}
          onOpenReports={() => {
            setSettingsOpen(false);
            setReportsOpen(true);
          }}
          onOpenAudit={() => {
            setSettingsOpen(false);
            setAuditOpen(true);
          }}
        />
      )}

      {askAiOpen && (
        <AskAiSheet lang={lang} onClose={() => setAskAiOpen(false)} />
      )}
    </div>
  );
}
