-- Round 22 (tax module): store-level filing config.
--   gst_scheme   'regular' (collect + remit) | 'composition' (flat 1% of turnover)
--   presumptive  income tax under s.44AD (profit = 6/8% of turnover)
-- The tax report itself is computed on-device from store.sales; nothing else
-- to store here. Safe to re-run.

ALTER TABLE "store"."stores"
  ADD COLUMN IF NOT EXISTS "gst_scheme" text NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS "presumptive" boolean NOT NULL DEFAULT true;
