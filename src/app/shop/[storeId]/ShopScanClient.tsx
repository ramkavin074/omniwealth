'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface CatItem {
  name: string;
  barcode: string;
  price: number;
  unit: string;
}
interface Props {
  storeId: string;
  storeName: string;
  upiId: string | null;
  gstInclusive: boolean;
  items: CatItem[];
}

type Lang = 'ta' | 'en';
const T: Record<string, { ta: string; en: string }> = {
  scan: { ta: 'ஸ்கேன் செய்', en: 'Scan' },
  stop: { ta: 'நிறுத்து', en: 'Stop' },
  enterCode: { ta: 'பார்கோடு தட்டச்சு செய்', en: 'Type a barcode' },
  add: { ta: 'சேர்', en: 'Add' },
  empty: { ta: 'கூடையில் எதுவும் இல்லை. பொருட்களை ஸ்கேன் செய்யுங்கள்.', en: 'Basket is empty. Scan items to add them.' },
  total: { ta: 'மொத்தம்', en: 'Total' },
  gstIncl: { ta: 'GST உள்ளடங்கும்', en: 'incl. GST' },
  notFound: { ta: 'இந்த பொருள் பட்டியலில் இல்லை — கவுண்டரில் சொல்லுங்கள்', en: 'Not in the list — tell the counter' },
  payUpi: { ta: 'UPI-யில் இப்போது செலுத்து', en: 'Pay now by UPI' },
  paidTick: { ta: 'நான் செலுத்திவிட்டேன்', en: "I've paid" },
  showCounter: { ta: 'கவுண்டரில் காட்டு', en: 'Show at counter' },
  useCode: { ta: 'பதிலாக ஒரு குறியீடு பெறு', en: 'Get a code instead' },
  backToScan: { ta: 'மேலும் ஸ்கேன் செய்', en: 'Scan more' },
  qrHint: { ta: 'இதை கடைக்காரரிடம் காட்டுங்கள். அவர்கள் சரிபார்த்து பில் போடுவார்கள்.', en: 'Show this to the shopkeeper. They check the items and bill you.' },
  codeHint: { ta: 'இந்த குறியீட்டை கடைக்காரரிடம் சொல்லுங்கள் (2 மணி நேரம் செல்லும்).', en: 'Read this code to the shopkeeper (valid 2 hours).' },
  paidNote: { ta: 'UPI செலுத்தியதாக குறிக்கப்பட்டது — கவுண்டரில் உறுதி செய்யப்படும்.', en: 'Marked paid by UPI — the counter will confirm.' },
  codeFail: { ta: 'குறியீடு பெற முடியவில்லை. QR ஐப் பயன்படுத்துங்கள்.', en: 'Could not get a code. Use the QR.' },
  bigBasket: { ta: 'கூடை பெரியது — குறியீட்டைப் பயன்படுத்தவும்.', en: 'Basket is large — use a code.' },
};

const money = (n: number) =>
  '₹' + Math.round(n).toLocaleString('en-IN');

const QR_MAX_ITEMS = 40;

// BarcodeDetector isn't in the TS DOM lib.
interface BarcodeDetectorLike {
  detect(src: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
declare const BarcodeDetector:
  | { new (opts?: { formats?: string[] }): BarcodeDetectorLike }
  | undefined;

export default function ShopScanClient({
  storeId,
  storeName,
  upiId,
  gstInclusive,
  items,
}: Props) {
  const [lang, setLang] = useState<Lang>('ta');
  const t = (k: string) => T[k][lang];

  const byBarcode = useMemo(() => {
    const m = new Map<string, CatItem>();
    for (const it of items) m.set(it.barcode, it);
    return m;
  }, [items]);

  const LS_KEY = `shop.basket.${storeId}`;
  const [basket, setBasket] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(basket));
    } catch {
      /* ignore */
    }
  }, [LS_KEY, basket]);

  const [msg, setMsg] = useState('');
  const flash = (s: string) => {
    setMsg(s);
    window.setTimeout(() => setMsg(''), 2200);
  };

  const add = useCallback(
    (barcode: string) => {
      const bc = barcode.trim();
      if (!bc) return;
      if (!byBarcode.has(bc)) {
        flash(t('notFound'));
        return;
      }
      setBasket((b) => ({ ...b, [bc]: (b[bc] ?? 0) + 1 }));
    },
    [byBarcode], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const setQty = (bc: string, q: number) =>
    setBasket((b) => {
      const next = { ...b };
      if (q <= 0) delete next[bc];
      else next[bc] = q;
      return next;
    });

  const lines = Object.entries(basket)
    .map(([bc, qty]) => ({ it: byBarcode.get(bc)!, qty }))
    .filter((l) => l.it);
  const total = lines.reduce((s, l) => s + l.it.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  // ---- camera scanning (BarcodeDetector) ----
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const canScan = typeof BarcodeDetector !== 'undefined';

  const stopScan = useCallback(() => {
    setScanning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((tk) => tk.stop());
    streamRef.current = null;
  }, []);

  const startScan = useCallback(async () => {
    if (!canScan) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setScanning(true);
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play();
      const det = new BarcodeDetector!({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
      });
      let last = '';
      let lastAt = 0;
      const tick = async () => {
        if (!streamRef.current) return;
        try {
          const hits = await det.detect(v);
          const now = Date.now();
          if (hits[0]?.rawValue && (hits[0].rawValue !== last || now - lastAt > 1500)) {
            last = hits[0].rawValue;
            lastAt = now;
            add(last);
            if (navigator.vibrate) navigator.vibrate(40);
          }
        } catch {
          /* frame not ready */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      flash(lang === 'ta' ? 'கேமராவை அணுக முடியவில்லை' : 'Camera unavailable');
      stopScan();
    }
  }, [add, canScan, lang, stopScan]);

  useEffect(() => stopScan, [stopScan]);

  // ---- handoff ----
  const [phase, setPhase] = useState<'scan' | 'qr' | 'code'>('scan');
  const [paidUpi, setPaidUpi] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const showQr = async () => {
    if (lines.length === 0) return;
    if (lines.length > QR_MAX_ITEMS) {
      flash(t('bigBasket'));
      return getCode();
    }
    const payload = JSON.stringify({
      v: 1,
      s: storeId,
      p: paidUpi ? 1 : 0,
      i: lines.map((l) => [l.it.barcode, l.qty]),
    });
    try {
      setQrUrl(await QRCode.toDataURL(payload, { margin: 1, width: 320 }));
      setPhase('qr');
    } catch {
      getCode();
    }
  };

  const getCode = async () => {
    if (lines.length === 0 || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/stocking/basket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store: storeId,
          paidUpi,
          items: lines.map((l) => ({ barcode: l.it.barcode, qty: l.qty })),
        }),
      });
      const data = await res.json();
      if (res.ok && data.code) {
        setCode(data.code);
        setPhase('code');
      } else {
        flash(t('codeFail'));
      }
    } catch {
      flash(t('codeFail'));
    } finally {
      setBusy(false);
    }
  };

  const payUpi = () => {
    if (!upiId) return;
    const p = new URLSearchParams({
      pa: upiId,
      pn: storeName,
      am: Math.round(total).toString(),
      cu: 'INR',
      tn: `${storeName} self-scan`,
    });
    window.location.assign(`upi://pay?${p.toString()}`);
  };

  const clearAll = () => {
    setBasket({});
    setPaidUpi(false);
    setPhase('scan');
  };

  const wrap = 'mx-auto max-w-md px-4 pb-24';

  // ---------- handoff screens ----------
  if (phase !== 'scan') {
    return (
      <main className={`${wrap} pt-8 text-center text-slate-800`}>
        <h1 className="text-lg font-bold">{storeName}</h1>
        {phase === 'qr' ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt="basket QR"
              className="mx-auto mt-6 w-64 rounded-xl border border-slate-200"
            />
          </>
        ) : (
          <div className="mx-auto mt-8 rounded-2xl border border-slate-200 py-8">
            <div className="text-5xl font-extrabold tracking-[0.2em] text-slate-900">
              {code}
            </div>
          </div>
        )}
        <p className="mt-3 text-sm text-slate-500">
          {phase === 'qr' ? t('qrHint') : t('codeHint')}
        </p>
        <p className="mt-2 text-sm font-semibold text-slate-800">
          {count} {lang === 'ta' ? 'பொருட்கள்' : 'items'} · {money(total)}
        </p>
        {paidUpi && (
          <p className="mt-1 text-sm font-medium text-emerald-700">
            {t('paidNote')}
          </p>
        )}
        <button
          type="button"
          onClick={() => setPhase('scan')}
          className="mt-6 h-11 w-full rounded-xl bg-slate-200 font-semibold text-slate-700"
        >
          {t('backToScan')}
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="mt-2 text-sm font-medium text-rose-600"
        >
          {lang === 'ta' ? 'கூடையை காலி செய்' : 'Clear basket'}
        </button>
      </main>
    );
  }

  // ---------- scan screen ----------
  return (
    <main className={`${wrap} pt-4 text-slate-800`}>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{storeName}</h1>
        <button
          type="button"
          onClick={() => setLang((l) => (l === 'ta' ? 'en' : 'ta'))}
          className="rounded-lg bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-700"
        >
          {lang === 'ta' ? 'EN' : 'த'}
        </button>
      </div>

      {canScan && (
        <div className="mt-3">
          {scanning ? (
            <>
              <video
                ref={videoRef}
                className="w-full rounded-xl bg-black"
                playsInline
                muted
              />
              <button
                type="button"
                onClick={stopScan}
                className="mt-2 h-11 w-full rounded-xl bg-slate-200 font-semibold text-slate-700"
              >
                {t('stop')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startScan}
              className="h-12 w-full rounded-xl bg-teal-700 font-semibold text-white"
            >
              {t('scan')}
            </button>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const el = (e.currentTarget.elements.namedItem('bc') as HTMLInputElement);
          add(el.value);
          el.value = '';
        }}
        className="mt-2 flex gap-2"
      >
        <input
          name="bc"
          inputMode="numeric"
          placeholder={t('enterCode')}
          className="h-11 flex-1 rounded-lg border border-slate-300 px-3"
        />
        <button
          type="submit"
          className="h-11 rounded-lg bg-slate-200 px-4 font-semibold text-slate-700"
        >
          {t('add')}
        </button>
      </form>

      {msg && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {msg}
        </p>
      )}

      <ul className="mt-4 divide-y divide-slate-200">
        {lines.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">{t('empty')}</p>
        )}
        {lines.map((l) => (
          <li key={l.it.barcode} className="flex items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {l.it.name}
              </span>
              <span className="text-xs text-slate-400">{money(l.it.price)}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQty(l.it.barcode, l.qty - 1)}
                className="h-8 w-8 rounded-lg bg-slate-200 text-lg font-bold text-slate-700"
              >
                −
              </button>
              <span className="w-6 text-center tabular-nums">{l.qty}</span>
              <button
                type="button"
                onClick={() => setQty(l.it.barcode, l.qty + 1)}
                className="h-8 w-8 rounded-lg bg-slate-200 text-lg font-bold text-slate-700"
              >
                +
              </button>
            </div>
            <span className="w-16 text-right text-sm font-semibold tabular-nums">
              {money(l.it.price * l.qty)}
            </span>
          </li>
        ))}
      </ul>

      {lines.length > 0 && (
        <>
          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
            <span className="font-semibold">{t('total')}</span>
            <span className="text-lg font-extrabold tabular-nums">
              {money(total)}
              {gstInclusive && (
                <span className="ml-1 text-xs font-normal text-slate-400">
                  {t('gstIncl')}
                </span>
              )}
            </span>
          </div>

          {upiId && (
            <div className="mt-3">
              <button
                type="button"
                onClick={payUpi}
                className="h-11 w-full rounded-xl bg-emerald-600 font-semibold text-white"
              >
                {t('payUpi')} · {money(total)}
              </button>
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={paidUpi}
                  onChange={(e) => setPaidUpi(e.target.checked)}
                  className="h-5 w-5 accent-emerald-600"
                />
                {t('paidTick')}
              </label>
            </div>
          )}

          <button
            type="button"
            onClick={showQr}
            disabled={busy}
            className="mt-4 h-12 w-full rounded-xl bg-teal-700 text-base font-bold text-white disabled:opacity-50"
          >
            {t('showCounter')}
          </button>
          <button
            type="button"
            onClick={getCode}
            disabled={busy}
            className="mt-2 w-full text-sm font-medium text-teal-700"
          >
            {t('useCode')}
          </button>
        </>
      )}
    </main>
  );
}
