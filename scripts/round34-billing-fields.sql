-- Round 34: bill rounding + per-line discount %.
--   sales.roundoff — the ± adjustment applied to reach a round total (the
--     total column already includes it). Per-line discount % rides inside the
--     existing sales.items jsonb (SaleItem.discountPct), no column needed.
-- Safe to re-run.

ALTER TABLE "store"."sales"
  ADD COLUMN IF NOT EXISTS "roundoff" numeric NOT NULL DEFAULT '0';
