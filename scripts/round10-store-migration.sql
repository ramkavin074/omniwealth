-- ============================================================
-- Round 10 migration: household-keyed stocking  ->  `store` schema
-- ============================================================
-- SELF-CONTAINED. Run this whole file once in the Neon SQL editor.
-- It creates the `store` schema + tables itself (no dependency on
-- `drizzle-kit push`), then copies the pilot data across.
--
-- The DROP SCHEMA at the top is safe: nothing real lives in `store.*` yet.
-- Object names match what Drizzle generates, so a later `drizzle-kit push`
-- sees the schema as already-in-sync and does nothing.
--
-- Legacy public.stock_products / public.stock_movements are left intact —
-- dropped only after the app code is switched to `store.*` and verified.
--
-- Pilot shops:
--   Kavin Family Vault  a0000000-0000-0000-0000-000000000001 -> Kavin Store
--   LB (Lenin)          134d4fbe-c15f-43bf-948d-979fa3887c45 -> Lenin Mobiles
-- ============================================================

-- ---------- schema + tables ----------
DROP SCHEMA IF EXISTS store CASCADE;
CREATE SCHEMA store;

CREATE TABLE store.stores (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name"       text NOT NULL,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE store.store_members (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id"   uuid NOT NULL,
  "user_id"    uuid NOT NULL,
  "role"       text DEFAULT 'staff' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE store.suppliers (
  "id"         uuid PRIMARY KEY NOT NULL,
  "store_id"   uuid NOT NULL,
  "name"       text NOT NULL,
  "phone"      text,
  "note"       text,
  "updated_at" numeric NOT NULL,
  "deleted_at" numeric,
  "synced_at"  timestamp DEFAULT now() NOT NULL
);

CREATE TABLE store.products (
  "id"                  uuid PRIMARY KEY NOT NULL,
  "store_id"            uuid NOT NULL,
  "barcode"             text,
  "name"                text NOT NULL,
  "mrp"                 numeric DEFAULT '0' NOT NULL,
  "price"               numeric DEFAULT '0' NOT NULL,
  "cost_price"          numeric DEFAULT '0' NOT NULL,
  "stock_qty"           numeric DEFAULT '0' NOT NULL,
  "unit"                text DEFAULT 'piece' NOT NULL,
  "low_stock_threshold" numeric DEFAULT '0' NOT NULL,
  "updated_at"          numeric NOT NULL,
  "deleted_at"          numeric,
  "synced_at"           timestamp DEFAULT now() NOT NULL
);

CREATE TABLE store.stock_movements (
  "id"          uuid PRIMARY KEY NOT NULL,
  "store_id"    uuid NOT NULL,
  "product_id"  uuid NOT NULL,
  "user_id"     uuid,
  "supplier_id" uuid,
  "delta"       numeric NOT NULL,
  "reason"      text NOT NULL,
  "qty_after"   numeric NOT NULL,
  "unit_cost"   numeric,
  "note"        text,
  "created_at"  numeric NOT NULL,
  "synced_at"   timestamp DEFAULT now() NOT NULL
);

-- ---------- foreign keys ----------
ALTER TABLE store.stores        ADD CONSTRAINT "stores_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");
ALTER TABLE store.store_members ADD CONSTRAINT "store_members_store_id_stores_id_fk"
  FOREIGN KEY ("store_id") REFERENCES "store"."stores"("id") ON DELETE cascade;
ALTER TABLE store.store_members ADD CONSTRAINT "store_members_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
ALTER TABLE store.suppliers     ADD CONSTRAINT "suppliers_store_id_stores_id_fk"
  FOREIGN KEY ("store_id") REFERENCES "store"."stores"("id") ON DELETE cascade;
ALTER TABLE store.products      ADD CONSTRAINT "products_store_id_stores_id_fk"
  FOREIGN KEY ("store_id") REFERENCES "store"."stores"("id") ON DELETE cascade;
ALTER TABLE store.stock_movements ADD CONSTRAINT "stock_movements_store_id_stores_id_fk"
  FOREIGN KEY ("store_id") REFERENCES "store"."stores"("id") ON DELETE cascade;
ALTER TABLE store.stock_movements ADD CONSTRAINT "stock_movements_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");

-- ---------- indexes ----------
CREATE UNIQUE INDEX "store_members_store_user_idx" ON store.store_members ("store_id","user_id");
CREATE INDEX "store_members_user_idx"              ON store.store_members ("user_id");
CREATE INDEX "store_suppliers_store_synced_idx"    ON store.suppliers     ("store_id","synced_at");
CREATE INDEX "store_products_store_synced_idx"     ON store.products      ("store_id","synced_at");
CREATE INDEX "store_products_store_barcode_idx"    ON store.products      ("store_id","barcode");
CREATE INDEX "store_movements_store_synced_idx"    ON store.stock_movements ("store_id","synced_at");
CREATE INDEX "store_movements_product_idx"         ON store.stock_movements ("product_id");

-- ---------- households shell flag ----------
ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS "is_store_shell" boolean NOT NULL DEFAULT false;

-- ============================================================
-- data migration
-- ============================================================

-- 1. one store per pilot shop
INSERT INTO store.stores (id, name, created_by) VALUES
  ('50000000-0000-0000-0000-000000000001', 'Kavin Store',
   (SELECT id FROM users WHERE household_id = 'a0000000-0000-0000-0000-000000000001'
    ORDER BY (role = 'OWNER') DESC, created_at LIMIT 1)),
  ('50000000-0000-0000-0000-000000000002', 'Lenin Mobiles',
   (SELECT id FROM users WHERE household_id = '134d4fbe-c15f-43bf-948d-979fa3887c45'
    ORDER BY (role = 'OWNER') DESC, created_at LIMIT 1));

-- 2. every current household user -> 'owner'
INSERT INTO store.store_members (store_id, user_id, role)
SELECT '50000000-0000-0000-0000-000000000001', id, 'owner'
FROM users WHERE household_id = 'a0000000-0000-0000-0000-000000000001';
INSERT INTO store.store_members (store_id, user_id, role)
SELECT '50000000-0000-0000-0000-000000000002', id, 'owner'
FROM users WHERE household_id = '134d4fbe-c15f-43bf-948d-979fa3887c45';

-- 3. catalogue, re-keyed household_id -> store_id
INSERT INTO store.products
  (id, store_id, barcode, name, mrp, price, cost_price, stock_qty, unit,
   low_stock_threshold, updated_at, deleted_at, synced_at)
SELECT id,
       CASE household_id
         WHEN 'a0000000-0000-0000-0000-000000000001' THEN '50000000-0000-0000-0000-000000000001'
         WHEN '134d4fbe-c15f-43bf-948d-979fa3887c45' THEN '50000000-0000-0000-0000-000000000002'
       END::uuid,
       barcode, name, mrp, price, cost_price, stock_qty, unit,
       low_stock_threshold, updated_at, deleted_at, now()
FROM public.stock_products
WHERE household_id IN ('a0000000-0000-0000-0000-000000000001',
                       '134d4fbe-c15f-43bf-948d-979fa3887c45');

-- 4. movements
INSERT INTO store.stock_movements
  (id, store_id, product_id, user_id, supplier_id, delta, reason, qty_after,
   unit_cost, note, created_at, synced_at)
SELECT id,
       CASE household_id
         WHEN 'a0000000-0000-0000-0000-000000000001' THEN '50000000-0000-0000-0000-000000000001'
         WHEN '134d4fbe-c15f-43bf-948d-979fa3887c45' THEN '50000000-0000-0000-0000-000000000002'
       END::uuid,
       product_id, user_id, NULL, delta, reason, qty_after,
       unit_cost, note, created_at, now()
FROM public.stock_movements
WHERE household_id IN ('a0000000-0000-0000-0000-000000000001',
                       '134d4fbe-c15f-43bf-948d-979fa3887c45');

-- 5. verify — expect:
--    Kavin Store    members=3   live_products=14
--    Lenin Mobiles  members=1   live_products=21
SELECT s.name,
       (SELECT count(*) FROM store.store_members m WHERE m.store_id = s.id)                    AS members,
       (SELECT count(*) FROM store.products p WHERE p.store_id = s.id AND p.deleted_at IS NULL) AS live_products,
       (SELECT count(*) FROM store.products p WHERE p.store_id = s.id)                          AS all_products,
       (SELECT count(*) FROM store.stock_movements mv WHERE mv.store_id = s.id)                 AS movements
FROM store.stores s
ORDER BY s.name;
