// Optional online lookup of a product name from its barcode, used only on the
// "not found" path of a scan. Checks the offline cache first, then the server
// (Open Food Facts behind /api/stocking/barcode-lookup). Never blocks the
// manual-entry flow — any failure just resolves to null.

import { API_BASE } from './config';
import { cacheBarcodeLookup, getCachedBarcode } from './db/products';

export interface LookupHit {
  name: string;
  brand: string | null;
  fromCache: boolean;
}

// Re-query the server at most once a week for a barcode that previously missed.
const MISS_TTL = 7 * 24 * 60 * 60 * 1000;

export async function lookupBarcodeName(
  barcode: string,
): Promise<LookupHit | null> {
  const code = barcode.trim();
  if (!/^\d{6,14}$/.test(code)) return null;

  const cached = await getCachedBarcode(code);
  if (cached) {
    if (cached.found && cached.name) {
      return { name: cached.name, brand: cached.brand, fromCache: true };
    }
    if (Date.now() - cached.fetchedAt < MISS_TTL) return null;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }

  try {
    const res = await fetch(
      `${API_BASE}/api/stocking/barcode-lookup?code=${encodeURIComponent(code)}`,
      { signal: AbortSignal.timeout(7000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      found?: boolean;
      name?: string;
      brand?: string | null;
    };

    const found = data.found === true && !!data.name;
    await cacheBarcodeLookup({
      barcode: code,
      name: found ? data.name! : null,
      brand: data.brand ?? null,
      found,
      fetchedAt: Date.now(),
    });

    return found
      ? { name: data.name!, brand: data.brand ?? null, fromCache: false }
      : null;
  } catch {
    return null;
  }
}
