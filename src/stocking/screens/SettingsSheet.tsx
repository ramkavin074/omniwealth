'use client';

import { useEffect, useState } from 'react';
import { t, unitLabel, type Lang } from '../i18n';
import { useNow } from '../hooks';
import { SHEET_OVERLAY, SHEET_PANEL } from '../ui';
import { GST_RATES, UNITS, type Unit } from '../types';
import {
  APP_VERSION,
  canManage,
  cleanBillSeries,
  clearAllData,
  getDefaults,
  getReceiptConfig,
  hasStandaloneAuth,
  setDefaults,
  setReceiptConfig,
  signOut,
  type ReceiptConfig,
} from '../settings';
import { lastSyncAt, syncNow, type SyncOutcome } from '../sync';
import {
  forgetPrinter,
  getPrinter,
  isBlePrintingAvailable,
  pairPrinter,
  testPrint,
} from '../printer';
import { isLikelyVpa } from '../upiLink';
import {
  getStoreSettings,
  saveAlertPhone,
  saveStoreSettings,
} from '../storeSettings';

interface Props {
  lang: Lang;
  onClose: () => void;
  onOpenSuppliers: () => void;
  onOpenCustomers: () => void;
  onOpenOrders: () => void;
  onOpenExpenses: () => void;
  onOpenPurchases: () => void;
  onOpenAccountant: () => void;
  onOpenReports: () => void;
  onOpenAudit: () => void;
  onOpenSales: () => void;
  onOpenTax: () => void;
  onOpenUpi: () => void;
}

const field =
  'h-11 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 text-slate-900 dark:text-slate-50';
const heading =
  'text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500';

export default function SettingsSheet({
  lang,
  onClose,
  onOpenSuppliers,
  onOpenCustomers,
  onOpenOrders,
  onOpenExpenses,
  onOpenPurchases,
  onOpenAccountant,
  onOpenReports,
  onOpenAudit,
  onOpenSales,
  onOpenTax,
  onOpenUpi,
}: Props) {
  const initial = getDefaults();
  const [manage] = useState(canManage);
  const [unit, setUnit] = useState<Unit>(initial.unit);
  const [threshold, setThreshold] = useState(String(initial.lowStockThreshold));
  const [rc, setRc] = useState<ReceiptConfig>(getReceiptConfig);
  const [rcSaved, setRcSaved] = useState(false);
  const standalone = hasStandaloneAuth();

  const [printer, setPrinter] = useState(getPrinter);
  const [prBusy, setPrBusy] = useState(false);
  const [prMsg, setPrMsg] = useState<string | null>(null);

  const pairThermal = async () => {
    setPrBusy(true);
    setPrMsg(null);
    const r = await pairPrinter();
    setPrBusy(false);
    if (r.ok) {
      setPrinter(r.printer);
      setPrMsg(t(lang, 'receipt.printerPaired'));
    } else {
      setPrMsg(
        t(lang, r.reason === 'unsupported' ? 'receipt.printerWeb' : 'receipt.printerFail'),
      );
    }
  };
  const testThermal = async () => {
    setPrBusy(true);
    setPrMsg(null);
    const r = await testPrint(rc);
    setPrBusy(false);
    setPrMsg(t(lang, r.ok ? 'receipt.sent' : 'receipt.printerFail'));
  };
  const forgetThermal = () => {
    forgetPrinter();
    setPrinter(null);
    setPrMsg(null);
  };

  const patchRc = (p: Partial<ReceiptConfig>) => {
    const next = { ...rc, ...p };
    setRc(next);
    setReceiptConfig(next);
    setRcSaved(true);
  };

  const now = useNow();
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const [alertPhone, setAlertPhone] = useState('');
  const [alertState, setAlertState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');

  // GST + tax setup
  const [gstin, setGstin] = useState('');
  const [gstEnabled, setGstEnabled] = useState(false);
  const [pricesInclTax, setPricesInclTax] = useState(true);
  const [defaultGstRate, setDefaultGstRate] = useState('0');
  const [gstScheme, setGstScheme] = useState<'regular' | 'composition'>(
    'regular',
  );
  const [presumptive, setPresumptive] = useState(true);
  const [gstState, setGstState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');

  useEffect(() => {
    lastSyncAt().then(setSyncedAt);
  }, []);

  useEffect(() => {
    if (!manage) return;
    getStoreSettings()
      .then((s) => {
        setAlertPhone(s.alertPhone ?? '');
        setGstin(s.gstin ?? '');
        setGstEnabled(s.gstEnabled);
        setPricesInclTax(s.pricesIncludeTax);
        setDefaultGstRate(String(s.defaultGstRate));
        setGstScheme(s.gstScheme);
        setPresumptive(s.presumptive);
      })
      .catch(() => {});
  }, [manage]);

  const saveAlert = async () => {
    setAlertState('saving');
    try {
      const saved = await saveAlertPhone(alertPhone.trim());
      setAlertPhone(saved ?? '');
      setAlertState('saved');
    } catch {
      setAlertState('error');
    }
  };

  const saveGst = async () => {
    setGstState('saving');
    try {
      const s = await saveStoreSettings({
        gstin: gstin.trim(),
        gstEnabled,
        pricesIncludeTax: pricesInclTax,
        defaultGstRate: Number(defaultGstRate) || 0,
        gstScheme,
        presumptive,
      });
      setGstin(s.gstin ?? '');
      setGstState('saved');
    } catch {
      setGstState('error');
    }
  };

  const runSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    const r: SyncOutcome = await syncNow();
    setSyncing(false);
    if (r.ok) {
      setSyncedAt(Date.now());
      setSyncMsg(
        t(lang, 'sync.result')
          .replace('{up}', String(r.pushed))
          .replace('{down}', String(r.pulled)),
      );
    } else {
      setSyncMsg(t(lang, `sync.err.${r.error ?? 'server'}`));
    }
  };

  const agoText = () => {
    if (!syncedAt || !now) return t(lang, 'sync.never');
    const m = Math.round((now - syncedAt) / 60000);
    if (m < 1) return t(lang, 'sync.justNow');
    if (m < 60) return t(lang, 'sync.minsAgo').replace('{m}', String(m));
    return t(lang, 'sync.hoursAgo').replace('{h}', String(Math.round(m / 60)));
  };

  const persist = (u: Unit, thr: string) =>
    setDefaults({ unit: u, lowStockThreshold: Number(thr) || 0 });

  const wipe = async () => {
    if (!confirm(t(lang, 'settings.clearConfirm'))) return;
    await clearAllData();
    location.reload();
  };

  const logout = () => {
    signOut();
    location.reload();
  };

  return (
    <div className={`${SHEET_OVERLAY} z-30`}>
      <div
        className={`${SHEET_PANEL} max-h-[92vh] space-y-5 overflow-y-auto md:max-w-2xl`}
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
            {t(lang, 'settings.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-teal-700 dark:text-teal-300 font-medium"
          >
            {t(lang, 'settings.close')}
          </button>
        </div>

        <section className="space-y-2">
          <p className={heading}>{t(lang, 'sync.title')}</p>
          <button
            type="button"
            onClick={runSync}
            disabled={syncing}
            className="w-full h-11 rounded-lg bg-teal-700 font-semibold text-white disabled:opacity-50"
          >
            {syncing ? t(lang, 'sync.syncing') : t(lang, 'sync.now')}
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {syncMsg ?? `${t(lang, 'sync.last')}: ${agoText()}`}
          </p>
        </section>

        <section className="space-y-2">
          <p className={heading}>{t(lang, 'settings.tools')}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(
              [
                ['sales.title', onOpenSales, true],
                ['cust.title', onOpenCustomers, true],
                ['order.title', onOpenOrders, true],
                ['exp.title', onOpenExpenses, manage],
                ['pur.title', onOpenPurchases, manage],
                ['sup.manage', onOpenSuppliers, manage],
                ['tax.title', onOpenTax, manage],
                ['upi.title', onOpenUpi, manage],
                ['rep.title', onOpenReports, manage],
                ['acct.title', onOpenAccountant, manage],
                ['audit.title', onOpenAudit, true],
              ] as const
            )
              .filter(([, , show]) => show)
              .map(([key, onClick]) => (
                <button
                  key={key}
                  type="button"
                  onClick={onClick}
                  className="flex h-16 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-2 text-center text-sm font-semibold leading-tight text-slate-700 transition active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {t(lang, key)}
                </button>
              ))}
          </div>
        </section>

        {manage && (
          <section className="space-y-2">
            <p className={heading}>{t(lang, 'settings.alerts')}</p>
            <div className="flex gap-2">
              <input
                inputMode="tel"
                value={alertPhone}
                onChange={(e) => {
                  setAlertPhone(e.target.value);
                  setAlertState('idle');
                }}
                placeholder={t(lang, 'settings.alertPhone')}
                className={`${field} flex-1`}
              />
              <button
                type="button"
                onClick={saveAlert}
                disabled={alertState === 'saving'}
                className="h-11 rounded-lg bg-teal-700 px-4 font-semibold text-white disabled:opacity-50"
              >
                {t(lang, 'settings.alertSave')}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {alertState === 'saved'
                ? t(lang, 'settings.alertSaved')
                : alertState === 'error'
                  ? t(lang, 'settings.alertErr')
                  : t(lang, 'settings.alertHint')}
            </p>
          </section>
        )}

        {manage && (
          <section className="space-y-2">
            <p className={heading}>{t(lang, 'settings.gst')}</p>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={gstEnabled}
                onChange={(e) => {
                  setGstEnabled(e.target.checked);
                  setGstState('idle');
                }}
                className="h-5 w-5 accent-teal-600"
              />
              {t(lang, 'settings.gstEnabled')}
            </label>
            {gstEnabled && (
              <>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={pricesInclTax}
                    onChange={(e) => {
                      setPricesInclTax(e.target.checked);
                      setGstState('idle');
                    }}
                    className="h-5 w-5 accent-teal-600"
                  />
                  {t(lang, 'settings.gstInclusive')}
                </label>
                <div className="flex gap-2">
                  <input
                    value={gstin}
                    onChange={(e) => {
                      setGstin(e.target.value);
                      setGstState('idle');
                    }}
                    placeholder={t(lang, 'settings.gstin')}
                    className={`${field} flex-1 font-mono`}
                  />
                  <select
                    value={defaultGstRate}
                    onChange={(e) => {
                      setDefaultGstRate(e.target.value);
                      setGstState('idle');
                    }}
                    className={field}
                  >
                    {GST_RATES.map((r) => (
                      <option key={r} value={r}>
                        {r}%
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  {(['regular', 'composition'] as const).map((sc) => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => {
                        setGstScheme(sc);
                        setGstState('idle');
                      }}
                      className={`h-9 flex-1 rounded-lg text-sm font-semibold ${
                        gstScheme === sc
                          ? 'bg-teal-700 text-white'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {t(lang, `settings.gstScheme.${sc}`)}
                    </button>
                  ))}
                </div>
              </>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={presumptive}
                onChange={(e) => {
                  setPresumptive(e.target.checked);
                  setGstState('idle');
                }}
                className="h-5 w-5 accent-teal-600"
              />
              {t(lang, 'settings.presumptive')}
            </label>
            <button
              type="button"
              onClick={saveGst}
              disabled={gstState === 'saving'}
              className="h-10 w-full rounded-lg bg-teal-700 font-semibold text-white disabled:opacity-50"
            >
              {gstState === 'saved'
                ? t(lang, 'settings.alertSaved')
                : gstState === 'error'
                  ? t(lang, 'settings.alertErr')
                  : t(lang, 'settings.alertSave')}
            </button>
          </section>
        )}

        {manage && (
          <section className="space-y-2">
            <p className={heading}>{t(lang, 'receipt.title')}</p>
            <input
              value={rc.shopName}
              onChange={(e) => patchRc({ shopName: e.target.value })}
              placeholder={t(lang, 'receipt.shopName')}
              className={`${field} w-full`}
            />
            <input
              value={rc.line2}
              onChange={(e) => patchRc({ line2: e.target.value })}
              placeholder={t(lang, 'receipt.line2')}
              className={`${field} w-full`}
            />
            <input
              value={rc.footer}
              onChange={(e) => patchRc({ footer: e.target.value })}
              placeholder={t(lang, 'receipt.footer')}
              className={`${field} w-full`}
            />
            <div className="flex gap-2">
              {([58, 80] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => patchRc({ paper: p })}
                  className={`h-9 flex-1 rounded-lg text-sm font-semibold ${
                    rc.paper === p
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                  }`}
                >
                  {p}mm
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={rc.roundBills}
                onChange={(e) => patchRc({ roundBills: e.target.checked })}
                className="h-5 w-5 accent-teal-600"
              />
              {t(lang, 'receipt.roundBills')}
            </label>
            <div className="flex items-center gap-2">
              <label className="flex-1 text-sm text-slate-700 dark:text-slate-200">
                {t(lang, 'receipt.billSeries')}
              </label>
              <input
                value={rc.billSeries}
                onChange={(e) =>
                  patchRc({ billSeries: cleanBillSeries(e.target.value) })
                }
                placeholder="—"
                maxLength={4}
                className={`${field} w-20 text-center uppercase`}
              />
            </div>
            <input
              value={rc.upiId}
              onChange={(e) =>
                patchRc({ upiId: e.target.value.trim().toLowerCase() })
              }
              placeholder={t(lang, 'receipt.upiId')}
              inputMode="email"
              autoCapitalize="none"
              className={`${field} w-full ${
                rc.upiId && !isLikelyVpa(rc.upiId)
                  ? 'border-rose-400 dark:border-rose-500'
                  : ''
              }`}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t(lang, 'receipt.upiIdHint')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {rcSaved
                ? t(lang, 'settings.alertSaved')
                : t(lang, 'receipt.hint')}
            </p>

            <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {t(lang, 'receipt.printer')}
              </p>
              {printer ? (
                <>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {printer.name}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={testThermal}
                      disabled={prBusy}
                      className="h-9 flex-1 rounded-lg bg-slate-200 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:bg-slate-700 dark:text-slate-200"
                    >
                      {t(lang, 'receipt.printerTest')}
                    </button>
                    <button
                      type="button"
                      onClick={forgetThermal}
                      className="h-9 flex-1 rounded-lg bg-slate-100 text-sm font-medium text-rose-600 dark:bg-slate-800 dark:text-rose-400"
                    >
                      {t(lang, 'receipt.printerForget')}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={pairThermal}
                  disabled={prBusy}
                  className="h-9 w-full rounded-lg bg-teal-700 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {t(lang, 'receipt.printerConnect')}
                </button>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {prMsg ??
                  (isBlePrintingAvailable()
                    ? t(lang, 'receipt.printerHint')
                    : t(lang, 'receipt.printerWeb'))}
              </p>
            </div>
          </section>
        )}

        <section className="space-y-2">
          <p className={heading}>{t(lang, 'settings.defaults')}</p>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                {t(lang, 'product.unit')}
              </span>
              <select
                value={unit}
                onChange={(e) => {
                  const u = e.target.value as Unit;
                  setUnit(u);
                  persist(u, threshold);
                }}
                className={`${field} w-full`}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {unitLabel(lang, u)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                {t(lang, 'product.lowStockThreshold')}
              </span>
              <input
                inputMode="decimal"
                value={threshold}
                onChange={(e) => {
                  setThreshold(e.target.value);
                  persist(unit, e.target.value);
                }}
                className={`${field} w-full`}
              />
            </label>
          </div>
        </section>

        <section className="space-y-2">
          <p className={heading}>{t(lang, 'settings.data')}</p>
          <button
            type="button"
            onClick={wipe}
            className="w-full h-11 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-medium"
          >
            {t(lang, 'settings.clearData')}
          </button>
        </section>

        {standalone && (
          <section className="space-y-2">
            <p className={heading}>{t(lang, 'settings.account')}</p>
            <button
              type="button"
              onClick={logout}
              className="w-full h-11 rounded-lg bg-slate-200 dark:bg-slate-700 font-medium text-slate-700 dark:text-slate-100"
            >
              {t(lang, 'settings.logout')}
            </button>
          </section>
        )}

        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          {t(lang, 'app.title')} · v{APP_VERSION}
        </p>
      </div>
    </div>
  );
}
