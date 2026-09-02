-- ============================================================
-- Round 11 cleanup: drop the retired household-keyed stocking objects
-- ============================================================
-- Run ONLY after Round 10 + 11 are deployed and verified against `store.*`.
-- All data was migrated to store.* in Round 10 (verified: 14 / 21 products).
-- These are now dead weight.

DROP TABLE IF EXISTS public.stock_movements;
DROP TABLE IF EXISTS public.stock_products;

ALTER TABLE public.households DROP COLUMN IF EXISTS stocking_enabled;

-- verify: none should remain
SELECT to_regclass('public.stock_products')  AS stock_products_left,
       to_regclass('public.stock_movements') AS stock_movements_left;
SELECT column_name FROM information_schema.columns
WHERE table_name = 'households' AND column_name = 'stocking_enabled';
