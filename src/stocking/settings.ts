// Small per-device preferences (localStorage). Not synced — they only shape
// new-product defaults and the about screen.

import { db } from './db/dexie';
import {
  GST_CONFIG_FALLBACK,
  TAX_CONFIG_FALLBACK,
  type GstConfig,
  type TaxConfig,
  type Unit,
} from './types';

export const APP_VERSION = '0.1.0';

interface Defaults {
  unit: Unit;
  lowStockThreshold: number;
}

const KEY = 'stocking.defaults';
const FALLBACK: Defaults = { unit: 'piece', lowStockThreshold: 5 };

export function getDefaults(): Defaults {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return FALLBACK;
    const p = JSON.parse(raw) as Partial<Defaults>;
    return {
      unit: p.unit ?? FALLBACK.unit,
      lowStockThreshold:
        typeof p.lowStockThreshold === 'number'
          ? p.lowStockThreshold
          : FALLBACK.lowStockThreshold,
    };
  } catch {
    return FALLBACK;
  }
}

export function setDefaults(next: Defaults): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}

// ---- receipt / printing (C7) — per device, not synced ----

export interface ReceiptConfig {
  shopName: string;
  line2: string; // address / phone line under the name
  footer: string; // "Thank you, visit again"
  paper: 58 | 80; // mm — thermal roll width
  roundBills: boolean; // round every bill total to the nearest ₹1 (Indian norm)
}

const RECEIPT_KEY = 'stocking.receipt';
const RECEIPT_FALLBACK: ReceiptConfig = {
  shopName: '',
  line2: '',
  footer: 'Thank you! Visit again.',
  paper: 58,
  roundBills: true,
};

export function getReceiptConfig(): ReceiptConfig {
  try {
    const raw = localStorage.getItem(RECEIPT_KEY);
    if (!raw) return RECEIPT_FALLBACK;
    const p = JSON.parse(raw) as Partial<ReceiptConfig>;
    return {
      shopName: typeof p.shopName === 'string' ? p.shopName : '',
      line2: typeof p.line2 === 'string' ? p.line2 : '',
      footer:
        typeof p.footer === 'string' ? p.footer : RECEIPT_FALLBACK.footer,
      paper: p.paper === 80 ? 80 : 58,
      roundBills: p.roundBills !== false, // default on
    };
  } catch {
    return RECEIPT_FALLBACK;
  }
}

export function setReceiptConfig(next: ReceiptConfig): void {
  try {
    localStorage.setItem(RECEIPT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}

/** True in the standalone APK build (LoginGate cached a bearer token). The
 *  in-OmniWealth host seeds stocking.auth too, but without a token. */
export function hasStandaloneAuth(): boolean {
  try {
    const raw = localStorage.getItem('stocking.auth');
    return !!raw && !!(JSON.parse(raw) as { token?: string }).token;
  } catch {
    return false;
  }
}

export type StoreRole = 'owner' | 'manager' | 'staff';

interface AuthBlob {
  userId?: string;
  displayName?: string;
  storeId?: string;
  role?: StoreRole;
}

function readAuthBlob(): AuthBlob {
  try {
    const raw = localStorage.getItem('stocking.auth');
    return raw ? (JSON.parse(raw) as AuthBlob) : {};
  } catch {
    return {};
  }
}

/** The signed-in user's id — stamped on locally-created movements (the audit
 *  "who"). The sync server re-stamps authoritatively on push. */
export function getUserId(): string | null {
  return readAuthBlob().userId ?? null;
}

/** The active store's id (both hosts write this into stocking.auth). */
export function getStoreId(): string | null {
  return readAuthBlob().storeId ?? null;
}

/** The user's role in the active store. Defaults to the most restrictive. */
export function getStoreRole(): StoreRole {
  return readAuthBlob().role ?? 'staff';
}

/** owner / manager may edit the catalogue (name, price, cost, delete,
 *  import/export) and see cost & margin. staff can only move stock. */
export function canManage(): boolean {
  const r = getStoreRole();
  return r === 'owner' || r === 'manager';
}

/** Cost & margin are hidden from staff. */
export function canSeeCost(): boolean {
  return canManage();
}

// The store's GST setup, cached locally so billing works offline. Refreshed
// from every sync response and whenever an owner saves it in Settings.
const GST_KEY = 'stocking.gst';

export function getGstConfig(): GstConfig {
  try {
    const raw = localStorage.getItem(GST_KEY);
    if (!raw) return GST_CONFIG_FALLBACK;
    const p = JSON.parse(raw) as Partial<GstConfig>;
    return {
      enabled: !!p.enabled,
      inclusive: p.inclusive !== false,
      gstin: p.gstin ? String(p.gstin) : null,
      defaultRate:
        typeof p.defaultRate === 'number' ? p.defaultRate : 0,
    };
  } catch {
    return GST_CONFIG_FALLBACK;
  }
}

export function setGstConfig(c: GstConfig): void {
  try {
    localStorage.setItem(GST_KEY, JSON.stringify(c));
  } catch {
    /* storage unavailable */
  }
}

const TAX_KEY = 'stocking.tax';

export function getTaxConfig(): TaxConfig {
  try {
    const raw = localStorage.getItem(TAX_KEY);
    if (!raw) return TAX_CONFIG_FALLBACK;
    const p = JSON.parse(raw) as Partial<TaxConfig>;
    return {
      gstScheme: p.gstScheme === 'composition' ? 'composition' : 'regular',
      presumptive: p.presumptive !== false,
    };
  } catch {
    return TAX_CONFIG_FALLBACK;
  }
}

export function setTaxConfig(c: TaxConfig): void {
  try {
    localStorage.setItem(TAX_KEY, JSON.stringify(c));
  } catch {
    /* storage unavailable */
  }
}

export function signOut(): void {
  try {
    localStorage.removeItem('stocking.auth');
    localStorage.removeItem('stocking.storeId');
  } catch {
    /* ignore */
  }
}

/** Wipe the on-device catalogue, movements and lookup cache. Dexie's own
 *  delete() closes the live connections first, so it isn't left `blocked`
 *  the way a raw indexedDB.deleteDatabase would be. */
export async function clearAllData(): Promise<void> {
  await db().delete();
}
