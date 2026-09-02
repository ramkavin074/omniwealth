-- ============================================================
-- Round 11: store.supplier_payments  (supplier ledger)
-- ============================================================
-- Run once in the Neon SQL editor. `store.suppliers` and
-- `store.stock_movements.supplier_id` already exist from Round 10.
-- Idempotent: IF NOT EXISTS + guarded FK.

CREATE TABLE IF NOT EXISTS store.supplier_payments (
  "id"          uuid PRIMARY KEY NOT NULL,
  "store_id"    uuid NOT NULL,
  "supplier_id" uuid NOT NULL,
  "amount"      numeric NOT NULL,
  "note"        text,
  "paid_at"     numeric NOT NULL,
  "updated_at"  numeric NOT NULL,
  "deleted_at"  numeric,
  "synced_at"   timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE store.supplier_payments
    ADD CONSTRAINT "supplier_payments_store_id_stores_id_fk"
    FOREIGN KEY ("store_id") REFERENCES store.stores("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "store_supplier_payments_store_synced_idx"
  ON store.supplier_payments ("store_id","synced_at");
CREATE INDEX IF NOT EXISTS "store_supplier_payments_supplier_idx"
  ON store.supplier_payments ("supplier_id");

SELECT to_regclass('store.supplier_payments') AS created;
