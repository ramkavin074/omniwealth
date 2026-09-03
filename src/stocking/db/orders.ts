// Advance-booked orders / job-work (C2). An order is taken now, worked on,
// then delivered — at which point it becomes a Sale for the full agreed
// total and its status flips to 'delivered'. Advance / part-payments are
// recorded as Receipts against the customer (with againstOrderId) so they
// show in the customer ledger. Balance due is derived: total − advancePaid.

import { db } from './dexie';
import { uuid } from './products';
import { deviceTag } from './sales';
import { upsertCustomer } from './customers';
import { getUserId } from '../settings';
import type { OrderImportRow } from '../import';
import {
  orderBalance,
  todayISO,
  type Order,
  type OrderLine,
  type OrderStatus,
  type Receipt,
  type ReceiptTender,
  type Sale,
} from '../types';

const q = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const SEQ_KEY = 'stocking.ordersSeq';

function nextOrderNo(): string {
  let seq = 1;
  try {
    seq = Number(localStorage.getItem(SEQ_KEY) || '0') + 1;
    localStorage.setItem(SEQ_KEY, String(seq));
  } catch {
    /* ignore */
  }
  return `${deviceTag()}-O-${String(seq).padStart(4, '0')}`;
}

export async function listOrders(): Promise<Order[]> {
  const all = await db().orders.orderBy('createdAt').reverse().toArray();
  return all.filter((o) => o.deletedAt === null);
}

export async function getOrder(id: string): Promise<Order | undefined> {
  const o = await db().orders.get(id);
  return o && o.deletedAt === null ? o : undefined;
}

export async function ordersForCustomer(customerId: string): Promise<Order[]> {
  const rows = await db()
    .orders.where('customerId')
    .equals(customerId)
    .toArray();
  return rows
    .filter((o) => o.deletedAt === null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export interface OrderDraft {
  id?: string;
  customerId: string;
  customerName: string;
  lines: OrderLine[];
  dueDate?: string | null;
  note?: string;
  /** Advance taken at booking (create only). Recorded as a Receipt. */
  advance?: number;
  advanceTender?: ReceiptTender;
}

const cleanLines = (lines: OrderLine[]): OrderLine[] =>
  lines
    .map((l) => ({
      description: l.description.trim(),
      qty: q(Math.max(0, l.qty)),
      rate: q(Math.max(0, l.rate)),
    }))
    .filter((l) => l.description && l.qty > 0);

/** Create a new order (with an optional booking advance) or edit an existing
 *  one's lines / due date / note. */
export async function upsertOrder(draft: OrderDraft): Promise<Order> {
  const now = Date.now();
  const lines = cleanLines(draft.lines);
  const total = q(lines.reduce((t, l) => t + l.qty * l.rate, 0));

  if (draft.id) {
    const patch: Partial<Order> = {
      lines,
      total,
      updatedAt: now,
    };
    if (draft.dueDate !== undefined) patch.dueDate = draft.dueDate || null;
    if (draft.note !== undefined) patch.note = draft.note.trim() || null;
    if (draft.customerName) patch.customerName = draft.customerName;
    await db().orders.update(draft.id, patch);
    return (await db().orders.get(draft.id)) as Order;
  }

  const order: Order = {
    id: uuid(),
    orderNo: nextOrderNo(),
    customerId: draft.customerId,
    customerName: draft.customerName,
    lines,
    total,
    advancePaid: 0,
    status: 'booked',
    dueDate: draft.dueDate || null,
    note: draft.note?.trim() || null,
    billId: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await db().transaction('rw', db().orders, db().receipts, async () => {
    await db().orders.add(order);
    const adv = q(Math.max(0, draft.advance ?? 0));
    if (adv > 0) {
      const receipt: Receipt = {
        id: uuid(),
        customerId: order.customerId,
        amount: adv,
        tender: draft.advanceTender ?? 'cash',
        againstBillId: null,
        againstOrderId: order.id,
        note: `advance · order ${order.orderNo}`,
        receivedAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await db().receipts.add(receipt);
      await db().orders.update(order.id, {
        advancePaid: adv,
        updatedAt: now,
      });
      order.advancePaid = adv;
    }
  });
  return order;
}

/** Record a further part-payment on an order (bumps advancePaid + a Receipt). */
export async function addOrderPayment(input: {
  orderId: string;
  amount: number;
  tender: ReceiptTender;
  note?: string;
}): Promise<void> {
  const now = Date.now();
  await db().transaction('rw', db().orders, db().receipts, async () => {
    const order = await db().orders.get(input.orderId);
    if (!order || order.deletedAt !== null) return;
    const amt = q(Math.max(0, input.amount));
    if (amt <= 0) return;
    await db().receipts.add({
      id: uuid(),
      customerId: order.customerId,
      amount: amt,
      tender: input.tender,
      againstBillId: null,
      againstOrderId: order.id,
      note: input.note?.trim() || `part-payment · order ${order.orderNo}`,
      receivedAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    await db().orders.update(order.id, {
      advancePaid: q(order.advancePaid + amt),
      updatedAt: now,
    });
  });
}

export async function setOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<void> {
  const now = Date.now();
  await db().orders.update(id, { status, updatedAt: now });
}

export async function softDeleteOrder(id: string): Promise<void> {
  const now = Date.now();
  await db().orders.update(id, { deletedAt: now, updatedAt: now });
}

/** Hand the job over: create a Sale for the full order total (the balance is
 *  what changes hands now — the advance was already received as receipts),
 *  mark the order delivered and link the bill. Returns the new Sale. */
export async function deliverOrder(
  id: string,
  tender: ReceiptTender,
): Promise<Sale> {
  const now = Date.now();
  const order = await db().orders.get(id);
  if (!order || order.deletedAt !== null) throw new Error('Order not found');
  if (order.status === 'delivered') throw new Error('Already delivered');

  const balance = Math.max(0, orderBalance(order));
  const desc =
    order.lines.map((l) => `${l.qty}× ${l.description}`).join(', ') ||
    order.orderNo;

  const sale: Sale = {
    id: uuid(),
    billNo: order.orderNo, // reuse the order number as the bill number
    createdAt: now,
    userId: getUserId(),
    items: [],
    discount: 0,
    taxTotal: 0,
    taxBreakup: [],
    total: q(order.total),
    refundOf: null,
    tenderType: tender,
    customerId: order.customerId,
    cashAmount: tender === 'cash' ? balance : 0,
    upiAmount: tender === 'upi' ? balance : 0,
    cardAmount: 0,
    salesman: null,
    note:
      `order ${order.orderNo} · ${desc}` +
      (order.advancePaid > 0
        ? ` · advance ${order.advancePaid} adjusted`
        : ''),
    updatedAt: now,
    deletedAt: null,
  };

  await db().transaction('rw', db().orders, db().sales, async () => {
    await db().sales.add(sale);
    await db().orders.update(order.id, {
      status: 'delivered',
      billId: sale.id,
      // the balance changed hands on the bill — the order is now fully settled.
      // (No extra receipt: the delivery Sale's cash/upi already carries it.)
      advancePaid: q(order.total),
      updatedAt: now,
    });
  });
  return sale;
}

// ---- migration import ----

export interface OrderImportResult {
  added: number;
  skipped: number;
}

const digits = (s: string | null): string =>
  (s ?? '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');

const STATUS_MAP: Record<string, OrderStatus> = {
  booked: 'booked',
  new: 'booked',
  pending: 'booked',
  order: 'booked',
  'in progress': 'in_progress',
  in_progress: 'in_progress',
  progress: 'in_progress',
  processing: 'in_progress',
  wip: 'in_progress',
  printing: 'in_progress',
  ready: 'ready',
  done: 'ready',
  completed: 'delivered',
  delivered: 'delivered',
  closed: 'delivered',
  collected: 'delivered',
  cancelled: 'cancelled',
  canceled: 'cancelled',
};

const mapStatus = (s: string | null): OrderStatus =>
  (s && STATUS_MAP[s.trim().toLowerCase()]) || 'booked';

/** Bring open (advance-booked) jobs over from an existing billing app. Rows
 *  sharing an order number become one multi-line order. The customer is
 *  matched by phone or name and created if missing; the advance column is
 *  written as a receipt so the customer ledger stays correct. Re-running is
 *  safe — an order number that already exists is skipped. */
export async function importOrders(
  rows: OrderImportRow[],
): Promise<OrderImportResult> {
  const res: OrderImportResult = { added: 0, skipped: 0 };
  const now = Date.now();

  // group by order number; blank order numbers each stand alone
  const groups = new Map<string, OrderImportRow[]>();
  let anon = 0;
  for (const r of rows) {
    const key = r.orderNo?.trim() || ` anon-${anon++}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  // resolve / create customers up front (outside the orders transaction)
  const customers = await db().customers.toArray();
  const byPhone = new Map<string, { id: string; name: string }>();
  const byName = new Map<string, { id: string; name: string }>();
  for (const c of customers) {
    if (c.deletedAt !== null) continue;
    const d = digits(c.phone);
    if (d.length === 10) byPhone.set(d, c);
    byName.set(c.name.trim().toLowerCase(), c);
  }
  const resolveCustomer = async (
    name: string,
    phone: string | null,
  ): Promise<{ id: string; name: string }> => {
    const d = digits(phone);
    const hit =
      (d.length === 10 && byPhone.get(d)) ||
      byName.get(name.trim().toLowerCase());
    if (hit) return hit;
    const created = await upsertCustomer({
      name,
      phone: phone || undefined,
    });
    const rec = { id: created.id, name: created.name };
    if (d.length === 10) byPhone.set(d, rec);
    byName.set(name.trim().toLowerCase(), rec);
    return rec;
  };

  const existingOrders = await db().orders.toArray();
  const takenNos = new Set(
    existingOrders.filter((o) => o.deletedAt === null).map((o) => o.orderNo),
  );

  for (const [key, list] of groups) {
    const head = list[0];
    const providedNo = key.startsWith(' ') ? null : key;
    if (providedNo && takenNos.has(providedNo)) {
      res.skipped++;
      continue;
    }

    const cust = await resolveCustomer(head.customerName, head.phone);
    const lines: OrderLine[] = list.map((r) => {
      const rate =
        r.rate > 0
          ? r.rate
          : r.lineTotal != null && r.qty > 0
            ? q(r.lineTotal / r.qty)
            : r.lineTotal ?? 0;
      return { description: r.description, qty: r.qty || 1, rate: q(rate) };
    });
    const total = q(lines.reduce((t, l) => t + l.qty * l.rate, 0));
    const advance = q(
      Math.max(0, list.reduce((t, r) => t + (r.advance || 0), 0)),
    );
    const dueDate = list.map((r) => r.dueDate).find((d) => d) ?? null;
    const note = list.map((r) => r.note).find((n) => n) ?? null;
    const status = mapStatus(head.status);
    const orderNo = providedNo || nextOrderNo();
    const orderId = uuid();

    await db().transaction('rw', db().orders, db().receipts, async () => {
      const order: Order = {
        id: orderId,
        orderNo,
        customerId: cust.id,
        customerName: cust.name,
        lines,
        total,
        advancePaid: advance,
        status,
        dueDate,
        note,
        billId: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await db().orders.add(order);
      if (advance > 0) {
        const receipt: Receipt = {
          id: uuid(),
          customerId: cust.id,
          amount: advance,
          tender: 'cash',
          againstBillId: null,
          againstOrderId: orderId,
          note: `imported advance · order ${orderNo}`,
          receivedAt: now,
          updatedAt: now,
          deletedAt: null,
        };
        await db().receipts.add(receipt);
      }
    });
    takenNos.add(orderNo);
    res.added++;
  }

  return res;
}

// ---- home / summary helpers ----

export interface OrdersSummary {
  open: number; // booked + in_progress + ready
  ready: number;
  dueSoon: number; // open, dueDate within the next 7 days (or already past)
  advanceHeld: number; // Σ advancePaid on open orders
  balanceDue: number; // Σ (total − advancePaid) on open orders
}

export async function ordersSummary(): Promise<OrdersSummary> {
  const orders = await listOrders();
  const open = orders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled',
  );
  const soonCutoff = todayISO();
  const in7 = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();
  return {
    open: open.length,
    ready: open.filter((o) => o.status === 'ready').length,
    dueSoon: open.filter(
      (o) => o.dueDate && (o.dueDate <= in7 || o.dueDate < soonCutoff),
    ).length,
    advanceHeld: q(open.reduce((t, o) => t + o.advancePaid, 0)),
    balanceDue: q(open.reduce((t, o) => t + Math.max(0, orderBalance(o)), 0)),
  };
}
