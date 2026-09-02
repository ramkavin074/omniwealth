// Small per-device preferences (localStorage). Not synced — they only shape
// new-product defaults and the about screen.

import { db } from './db/dexie';
import type { Unit } from './types';

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
