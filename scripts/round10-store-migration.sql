-- ============================================================
-- Round 10 migration: household-keyed stocking  ->  `store` schema
-- ============================================================
-- Run AFTER `npx drizzle-kit push` has created the `store` schema, its
-- tables, and households.is_store_shell.
--
-- Safe to re-run: store/member inserts are guarded; product/movement copies
-- use ON CONFLICT (id) DO NOTHING (PK = client-generated uuid).
-- Does NOT drop the legacy public.stock_* tables — that happens only after
-- the app code is switched to `store.*` and verified.
--
-- Pilot shops:
--   Kavin Family Vault  a0000000-0000-0000-0000-000000000001  -> Kavin Store
--   LB (Lenin)          134d4fbe-c15f-43bf-948d-979fa3887c45  -> Lenin Mobiles
-- ============================================================

-- 1. one store per pilot shop (fixed ids for readable copy statements)
INSERT INTO store.stores (id, name, created_by, created_at)
SELECT '50000000-0000-0000-0000-000000000001', 'Kavin Store',
       (SELECT id FROM users
        WHERE household_id = 'a0000000-0000-0000-0000-000000000001'
        ORDER BY (role = 'OWNER') DESC, created_at LIMIT 1),
       now()
WHERE NOT EXISTS (SELECT 1 FROM store.stores
                  WHERE id = '50000000-0000-0000-0000-000000000001');

INSERT INTO store.stores (id, name, created_by, created_at)
SELECT '50000000-0000-0000-0000-000000000002', 'Lenin Mobiles',
       (SELECT id FROM users
        WHERE household_id = '134d4fbe-c15f-43bf-948d-979fa3887c45'
        ORDER BY (role = 'OWNER') DESC, created_at LIMIT 1),
       now()
WHERE NOT EXISTS (SELECT 1 FROM store.stores
                  WHERE id = '50000000-0000-0000-0000-000000000002');

-- 2. every current household user -> 'owner' of that store
--    (preserves existing access; downgrade/remove specific people after)
INSERT INTO store.store_members (store_id, user_id, role)
SELECT '50000000-0000-0000-0000-000000000001', u.id, 'owner'
FROM users u
WHERE u.household_id = 'a0000000-0000-0000-0000-000000000001'
ON CONFLICT (store_id, user_id) DO NOTHING;

INSERT INTO store.store_members (store_id, user_id, role)
SELECT '50000000-0000-0000-0000-000000000002', u.id, 'owner'
FROM users u
WHERE u.household_id = '134d4fbe-c15f-43bf-948d-979fa3887c45'
ON CONFLICT (store_id, user_id) DO NOTHING;

-- helper: household -> store id
--   a0000000-…001 -> 50000000-…001
--   134d4fbe-…    -> 50000000-…002

-- 3. copy catalogue, re-keyed household_id -> store_id
INSERT INTO store.products
  (id, store_id, barcode, name, mrp, price, cost_price, stock_qty, unit,
   low_stock_threshold, updated_at, deleted_at, synced_at)
SELECT id,
       CASE household_id
         WHEN 'a0000000-0000-0000-0000-000000000001'
           THEN '50000000-0000-0000-0000-000000000001'
         WHEN '134d4fbe-c15f-43bf-948d-979fa3887c45'
           THEN '50000000-0000-0000-0000-000000000002'
       END,
       barcode, name, mrp, price, cost_price, stock_qty, unit,
       low_stock_threshold, updated_at, deleted_at, now()
FROM public.stock_products
WHERE household_id IN ('a0000000-0000-0000-0000-000000000001',
                       '134d4fbe-c15f-43bf-948d-979fa3887c45')
ON CONFLICT (id) DO NOTHING;

-- 4. copy movements
INSERT INTO store.stock_movements
  (id, store_id, product_id, user_id, supplier_id, delta, reason, qty_after,
   unit_cost, note, created_at, synced_at)
SELECT id,
       CASE household_id
         WHEN 'a0000000-0000-0000-0000-000000000001'
           THEN '50000000-0000-0000-0000-000000000001'
         WHEN '134d4fbe-c15f-43bf-948d-979fa3887c45'
           THEN '50000000-0000-0000-0000-000000000002'
       END,
       product_id, user_id, NULL, delta, reason, qty_after,
       unit_cost, note, created_at, now()
FROM public.stock_movements
WHERE household_id IN ('a0000000-0000-0000-0000-000000000001',
                       '134d4fbe-c15f-43bf-948d-979fa3887c45')
ON CONFLICT (id) DO NOTHING;

-- 5. verify — expect:
--    Kavin Store    members=3   live_products=14
--    Lenin Mobiles  members=1   live_products=21
SELECT s.name,
       (SELECT count(*) FROM store.store_members m WHERE m.store_id = s.id) AS members,
       (SELECT count(*) FROM store.products p
        WHERE p.store_id = s.id AND p.deleted_at IS NULL)                  AS live_products,
       (SELECT count(*) FROM store.products p WHERE p.store_id = s.id)     AS all_products,
       (SELECT count(*) FROM store.stock_movements mv WHERE mv.store_id = s.id) AS movements
FROM store.stores s
ORDER BY s.name;
