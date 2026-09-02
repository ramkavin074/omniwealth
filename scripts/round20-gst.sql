-- Round 20 (billing B3): GST.
--  store.stores        — the shop's GST setup (owner-set via Settings)
--  store.products      — per-item GST rate + optional HSN code
--  store.sales         — tax total + per-rate CGST/SGST breakup for the receipt
-- All additive with safe defaults. Safe to re-run.

ALTER TABLE "store"."stores"
  ADD COLUMN IF NOT EXISTS "gstin" text,
  ADD COLUMN IF NOT EXISTS "gst_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "prices_include_tax" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "default_gst_rate" numeric NOT NULL DEFAULT '0';

ALTER TABLE "store"."products"
  ADD COLUMN IF NOT EXISTS "gst_rate" numeric NOT NULL DEFAULT '0',
  ADD COLUMN IF NOT EXISTS "hsn" text;

ALTER TABLE "store"."sales"
  ADD COLUMN IF NOT EXISTS "tax_total" numeric NOT NULL DEFAULT '0',
  ADD COLUMN IF NOT EXISTS "tax_breakup" jsonb NOT NULL DEFAULT '[]';
