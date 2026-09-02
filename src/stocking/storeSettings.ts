// Client wrapper for GET/POST /api/stocking/store — per-store settings that
// aren't synced as rows (currently just the low-stock WhatsApp alert phone).
// Online-only; owner/manager only for writes (server enforces).

import { API_BASE } from './config';

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

export async function getStoreSettings(): Promise<{ alertPhone: string | null }> {
  const { token } = auth();
  const res = await fetch(`${API_BASE}/api/stocking/store`, {
    headers: headers(),
    credentials: token ? 'omit' : 'include',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to load');
  return { alertPhone: body?.store?.alertPhone ?? null };
}

export async function saveAlertPhone(alertPhone: string): Promise<string | null> {
  const { token } = auth();
  const res = await fetch(`${API_BASE}/api/stocking/store`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    credentials: token ? 'omit' : 'include',
    body: JSON.stringify({ alertPhone }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed to save');
  return body?.alertPhone ?? null;
}
