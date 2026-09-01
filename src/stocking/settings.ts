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

/** True in the standalone APK build (LoginGate cached a session). */
export function hasStandaloneAuth(): boolean {
  try {
    return !!localStorage.getItem('stocking.auth');
  } catch {
    return false;
  }
}

/** The signed-in user's id, if known — stamped on locally-created movements
 *  (the audit "who"). The sync server re-stamps authoritatively from the
 *  session on push; this is for offline display. */
export function getUserId(): string | null {
  try {
    const raw = localStorage.getItem('stocking.auth');
    if (!raw) return null;
    return (JSON.parse(raw) as { userId?: string }).userId ?? null;
  } catch {
    return null;
  }
}

export function signOut(): void {
  try {
    localStorage.removeItem('stocking.auth');
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
