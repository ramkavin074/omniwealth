// Client wrapper for GET/POST /api/stocking/store — per-store settings that
// aren't synced as rows: the low-stock WhatsApp alert phone and the GST setup.
// Online-only; owner/manager only for writes (server enforces). The sync
// response also echoes the GST fields, so billing has them offline.

import { API_BASE } from './config';
import { setGstConfig, setTaxConfig } from './settings';
import type { GstConfig, GstScheme, TaxConfig } from './types';

export interface StoreSettings {
  name?: string;
  alertPhone: string | null;
  gstin: string | null;
  gstEnabled: boolean;
  pricesIncludeTax: boolean;
  defaultGstRate: number;
  gstScheme: GstScheme;
  presumptive: boolean;
  selfScanEnabled: boolean;
  upiId: string | null;
}

function auth(): { token?: string; storeId?: string } {
  try {
    const raw = localStorage.getItem('stocking.auth');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function headers(): Record<string, string> {
  const { token, storeId } = auth();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(storeId ? { 'x-store-id': storeId } : {}),
  };
}

function normalise(s: Record<string, unknown> | null | undefined): StoreSettings {
  return {
    name: (s?.name as string) ?? undefined,
    alertPhone: (s?.alertPhone as string) ?? null,
    gstin: (s?.gstin as string) ?? null,
    gstEnabled: !!s?.gstEnabled,
    pricesIncludeTax: s?.pricesIncludeTax !== false,
    defaultGstRate: Number(s?.defaultGstRate) || 0,
    gstScheme: s?.gstScheme === 'composition' ? 'composition' : 'regular',
    presumptive: s?.presumptive !== false,
    selfScanEnabled: !!s?.selfScanEnabled,
    upiId: (s?.upiId as string) ?? null,
  };
}

/** Mirror the store's GST setup into the local cache billing reads offline. */
export function cacheGst(s: Pick<
  StoreSettings,
  'gstEnabled' | 'pricesIncludeTax' | 'gstin' | 'defaultGstRate'
>): void {
  const cfg: GstConfig = {
    enabled: s.gstEnabled,
    inclusive: s.pricesIncludeTax,
    gstin: s.gstin,
    defaultRate: s.defaultGstRate,
  };
  setGstConfig(cfg);
}

/** Mirror the tax-filing config into the local cache the Tax screen reads. */
export function cacheTax(s: Pick<StoreSettings, 'gstScheme' | 'presumptive'>): void {
  const cfg: TaxConfig = { gstScheme: s.gstScheme, presumptive: s.presumptive };
  setTaxConfig(cfg);
}

/** Mirror the store's UPI id into the receipt config so the offline bill /
 *  reminder `upi://pay` links keep working. */
export function cacheUpiId(s: Pick<StoreSettings, 'upiId'>): void {
  try {
    const raw = localStorage.getItem('stocking.receipt');
    const rc = raw ? JSON.parse(raw) : {};
    rc.upiId = (s.upiId ?? '').trim().toLowerCase();
    localStorage.setItem('stocking.receipt', JSON.stringify(rc));
  } catch {
    /* storage unavailable */
  }
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const { token } = auth();
  const res = await fetch(`${API_BASE}/api/stocking/store`, {
    headers: headers(),
    credentials: token ? 'omit' : 'include',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to load');
  const s = normalise(body?.store);
  cacheGst(s);
  cacheTax(s);
  cacheUpiId(s);
  return s;
}

export async function saveStoreSettings(
  patch: Partial<
    Pick<
      StoreSettings,
      | 'alertPhone'
      | 'gstin'
      | 'gstEnabled'
      | 'pricesIncludeTax'
      | 'defaultGstRate'
      | 'gstScheme'
      | 'presumptive'
      | 'selfScanEnabled'
      | 'upiId'
    >
  >,
): Promise<StoreSettings> {
  const { token } = auth();
  const res = await fetch(`${API_BASE}/api/stocking/store`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    credentials: token ? 'omit' : 'include',
    body: JSON.stringify(patch),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to save');
  const s = normalise(body?.store);
  cacheGst(s);
  cacheTax(s);
  cacheUpiId(s);
  return s;
}

/** Back-compat helper still used by the alert-phone field. */
export async function saveAlertPhone(alertPhone: string): Promise<string | null> {
  const s = await saveStoreSettings({ alertPhone });
  return s.alertPhone;
}
