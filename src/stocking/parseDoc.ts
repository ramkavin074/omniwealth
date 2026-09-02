// Client wrapper for POST /api/stocking/parse-document (photo → structured
// data). Online-only; the caller falls back to manual entry on failure.

import { API_BASE } from './config';

export interface InvoiceLine {
  name: string;
  barcode?: string;
  qty: number;
  unit: string;
  rate: number;
}

export interface PaymentDoc {
  supplierName: string;
  amount: number;
  date?: string;
  reference?: string;
}

export interface UpiRow {
  amount: number;
  receivedAt: number | null; // epoch ms, or null if the AI couldn't read a time
  payer?: string;
  ref?: string;
}

function auth(): { token?: string; storeId?: string } {
  try {
    const raw = localStorage.getItem('stocking.auth');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function post(file: File, kind: 'invoice' | 'payment' | 'upi') {
  const { token, storeId } = auth();
  const fd = new FormData();
  fd.append('image', file);
  fd.append('kind', kind);
  const res = await fetch(`${API_BASE}/api/stocking/parse-document`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(storeId ? { 'x-store-id': storeId } : {}),
    },
    credentials: token ? 'omit' : 'include',
    body: fd,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Scan failed');
  return body;
}

export async function parseInvoice(file: File): Promise<InvoiceLine[]> {
  const { data } = await post(file, 'invoice');
  return (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
    name: String(r.name ?? '').trim(),
    barcode: r.barcode ? String(r.barcode) : undefined,
    qty: Number(r.qty) || 0,
    unit: String(r.unit || 'piece'),
    rate: Number(r.rate) || 0,
  }));
}

export async function parsePayment(file: File): Promise<PaymentDoc> {
  const { data } = await post(file, 'payment');
  return {
    supplierName: String(data?.supplierName ?? '').trim(),
    amount: Number(data?.amount) || 0,
    date: data?.date ? String(data.date) : undefined,
    reference: data?.reference ? String(data.reference) : undefined,
  };
}

export async function parseUpiHistory(file: File): Promise<UpiRow[]> {
  const { data } = await post(file, 'upi');
  return (Array.isArray(data) ? data : [])
    .map((r: Record<string, unknown>) => {
      const amount = Number(r.amount) || 0;
      const raw = r.datetime ? String(r.datetime) : '';
      const t = raw ? Date.parse(raw) : NaN;
      return {
        amount,
        receivedAt: Number.isFinite(t) ? t : null,
        payer: r.payer ? String(r.payer).trim() : undefined,
        ref: r.ref ? String(r.ref).trim() : undefined,
      };
    })
    .filter((r) => r.amount > 0);
}
