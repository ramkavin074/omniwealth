// Customer self-scan basket, counter side. A basket is a list of
// {barcode, qty} plus a "customer says they paid by UPI" flag. It arrives
// either as a scanned QR (offline) or by short code (needs the network).
// The counter always re-prices from its own catalogue and reviews before
// billing — the customer's list carries no prices.

import { API_BASE } from './config';
import { getStoreId } from './settings';

export interface BasketPull {
  lines: { barcode: string; qty: number }[];
  paidUpi: boolean;
}

function cleanLines(raw: unknown): { barcode: string; qty: number }[] {
  if (!Array.isArray(raw)) return [];
  const out: { barcode: string; qty: number }[] = [];
  for (const r of raw) {
    // QR form: [barcode, qty]; code form: { barcode, qty }
    const barcode = Array.isArray(r)
      ? String(r[0] ?? '').trim()
      : String((r as { barcode?: unknown })?.barcode ?? '').trim();
    const qty = Number(Array.isArray(r) ? r[1] : (r as { qty?: unknown })?.qty);
    if (barcode && qty > 0) out.push({ barcode, qty: Math.round(qty * 1000) / 1000 });
  }
  return out;
}

/** Decode a scanned QR value. Returns null if it isn't one of our baskets. */
export function parseBasketQr(raw: string): BasketPull | { wrongStore: true } | null {
  let obj: { v?: unknown; s?: unknown; p?: unknown; i?: unknown };
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || obj.v !== 1 || !Array.isArray(obj.i)) return null;
  if (typeof obj.s === 'string' && getStoreId() && obj.s !== getStoreId()) {
    return { wrongStore: true };
  }
  const lines = cleanLines(obj.i);
  if (lines.length === 0) return null;
  return { lines, paidUpi: obj.p === 1 || obj.p === true };
}

/** Fetch a basket by its 4-char code (counter must be online). */
export async function fetchBasketByCode(
  code: string,
): Promise<BasketPull | { error: string }> {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(c)) return { error: 'bad-code' };
  let token: string | undefined;
  let storeId: string | undefined;
  try {
    const a = JSON.parse(localStorage.getItem('stocking.auth') || '{}');
    token = a.token;
    storeId = a.storeId;
  } catch {
    /* ignore */
  }
  try {
    const res = await fetch(
      `${API_BASE}/api/stocking/basket?store=${storeId ?? ''}&code=${c}`,
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(storeId ? { 'x-store-id': storeId } : {}),
        },
        credentials: token ? 'omit' : 'include',
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data?.error || 'not-found' };
    return { lines: cleanLines(data.items), paidUpi: data.paidUpi === true };
  } catch {
    return { error: 'network' };
  }
}
