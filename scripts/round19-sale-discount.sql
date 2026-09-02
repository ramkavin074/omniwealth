-- Round 19 (billing B2): bill-level discount on store.sales.
-- `discount` is the ₹ taken off the whole bill; total = subtotal − discount.
-- Held/parked carts are device-local and never sync, so no table for them.
-- Safe to re-run.

ALTER TABLE "store"."sales"
  ADD COLUMN IF NOT EXISTS "discount" numeric NOT NULL DEFAULT '0';
