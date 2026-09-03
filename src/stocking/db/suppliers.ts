// Supplier directory + payment ledger. Purchases are derived from the
// movement ledger (delta > 0 with a supplierId + unitCost); payments are
// explicit rows. balance owed = purchased − paid.

import { db } from './dexie';
import { uuid } from './products';
import type { Supplier, SupplierPayment } from '../types';

const q = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function listSuppliers(): Promise<Supplier[]> {
  const all = await db().suppliers.orderBy('name').toArray();
  return all.filter((s) => s.deletedAt === null);
}

export async function getSupplier(id: string): Promise<Supplier | undefined> {
  const s = await db().suppliers.get(id);
  return s && s.deletedAt === null ? s : undefined;
}

export async function createSupplier(input: {
  name: string;
  phone?: string;
  note?: string;
}): Promise<Supplier> {
  const now = Date.now();
  const supplier: Supplier = {
    id: uuid(),
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    note: input.note?.trim() || null,
    updatedAt: now,
    deletedAt: null,
  };
  await db().suppliers.add(supplier);
  return supplier;
}

export async function updateSupplier(
  id: string,
  patch: { name?: string; phone?: string; note?: string },
): Promise<void> {
  const clean: Partial<Supplier> = { updatedAt: Date.now() };
  if (patch.name !== undefined) clean.name = patch.name.trim();
  if (patch.phone !== undefined) clean.phone = patch.phone.trim() || null;
  if (patch.note !== undefined) clean.note = patch.note.trim() || null;
  await db().suppliers.update(id, clean);
}

export async function softDeleteSupplier(id: string): Promise<void> {
  await db().suppliers.update(id, {
    deletedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function recordPayment(input: {
  supplierId: string;
  amount: number;
  note?: string;
  paidAt?: number;
}): Promise<SupplierPayment> {
  const now = Date.now();
  const payment: SupplierPayment = {
    id: uuid(),
    supplierId: input.supplierId,
    amount: q(input.amount),
    note: input.note?.trim() || null,
    paidAt: input.paidAt ?? now,
    updatedAt: now,
    deletedAt: null,
  };
  await db().supplierPayments.add(payment);
  return payment;
}

export async function paymentsFor(
  supplierId: string,
): Promise<SupplierPayment[]> {
  const rows = await db()
    .supplierPayments.where('supplierId')
    .equals(supplierId)
    .toArray();
  return rows
    .filter((p) => p.deletedAt === null)
    .sort((a, b) => b.paidAt - a.paidAt);
}

export interface SupplierLedgerRow {
  supplier: Supplier;
  purchased: number; // goods value (Σ delta × unitCost) + Σ purchase GST input
  paid: number;
  balance: number; // purchased − paid (positive = owed)
}

export async function supplierLedger(): Promise<SupplierLedgerRow[]> {
  const [sups, movements, payments, purchases] = await Promise.all([
    listSuppliers(),
    db().movements.toArray(),
    db().supplierPayments.toArray(),
    db().purchases.toArray(),
  ]);

  // delta × unitCost, both signs: a stock-in adds to what's owed, a return
  // (negative delta, same supplier + cost) subtracts from it. This is the
  // ex-GST goods value (purchases write movements at the taxable rate).
  const purchasedBy = new Map<string, number>();
  for (const m of movements) {
    if (!m.supplierId || !m.unitCost || m.delta === 0) continue;
    purchasedBy.set(
      m.supplierId,
      (purchasedBy.get(m.supplierId) ?? 0) + m.delta * m.unitCost,
    );
  }
  // A purchase invoice's GST sits on top of the goods value the movement
  // already added — the supplier is owed the tax-inclusive total.
  for (const p of purchases) {
    if (p.deletedAt !== null || !p.gstInput) continue;
    purchasedBy.set(
      p.supplierId,
      (purchasedBy.get(p.supplierId) ?? 0) + p.gstInput,
    );
  }
  const paidBy = new Map<string, number>();
  for (const p of payments) {
    if (p.deletedAt !== null) continue;
    paidBy.set(p.supplierId, (paidBy.get(p.supplierId) ?? 0) + p.amount);
  }

  return sups.map((supplier) => {
    const purchased = q(purchasedBy.get(supplier.id) ?? 0);
    const paid = q(paidBy.get(supplier.id) ?? 0);
    return { supplier, purchased, paid, balance: q(purchased - paid) };
  });
}
