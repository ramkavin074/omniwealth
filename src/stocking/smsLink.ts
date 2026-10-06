// The shop's private "post bank SMS here" link, used with an iPhone Shortcuts automation.

import { API_BASE } from './config';

export interface SmsLinkStatus {
  connected: boolean;
  lastReceivedAt: number | null;
  /** Present only right after a link is created or replaced: the secret is never shown again. */
  url?: string;
}

const LIVE_KEY = 'stocking.liveUpi';

function authBlob(): { token?: string; storeId?: string } {
  try {
    const raw = localStorage.getItem('stocking.auth');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function call(action: 'status' | 'create' | 'revoke'): Promise<SmsLinkStatus | null> {
  const { token, storeId } = authBlob();
  try {
    const res = await fetch(`${API_BASE}/api/stocking/ingest-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(storeId ? { 'x-store-id': storeId } : {}),
      },
      credentials: token ? 'omit' : 'include',
      body: JSON.stringify({ action }),
    });
    if (!res.ok) return null;
    return (await res.json()) as SmsLinkStatus;
  } catch {
    return null;
  }
}

function setLive(on: boolean) {
  try {
    if (on) localStorage.setItem(LIVE_KEY, '1');
    else localStorage.removeItem(LIVE_KEY);
  } catch {
    /* ignore */
  }
}

/** True on phones where the owner connected the SMS link: they poll for new receipts. */
export function liveUpiEnabled(): boolean {
  try {
    return localStorage.getItem(LIVE_KEY) === '1';
  } catch {
    return false;
  }
}

export async function smsLinkStatus(): Promise<SmsLinkStatus | null> {
  const s = await call('status');
  if (s) setLive(s.connected);
  return s;
}

export async function createSmsLink(): Promise<SmsLinkStatus | null> {
  const s = await call('create');
  if (s?.connected) setLive(true);
  return s;
}

export async function revokeSmsLink(): Promise<SmsLinkStatus | null> {
  const s = await call('revoke');
  if (s) setLive(false);
  return s;
}
