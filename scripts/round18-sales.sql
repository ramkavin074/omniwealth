-- Round 18 (billing B1): the store.sales table — one row per bill.
-- Line items are embedded as JSON; the stock effect of each sale is recorded
-- separately as scan-out rows in store.stock_movements (which already sync).
-- This table is the bill record for receipts + day-end reporting.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS "store"."sales" (
  "id"           uuid PRIMARY KEY NOT NULL,
  "store_id"     uuid NOT NULL,
  "user_id"      uuid,
  "bill_no"      text NOT NULL,
  "items"        jsonb NOT NULL,
  "total"        numeric NOT NULL,
  "tender_type"  text NOT NULL,
  "cash_amount"  numeric DEFAULT '0' NOT NULL,
  "upi_amount"   numeric DEFAULT '0' NOT NULL,
  "note"         text,
  "created_at"   numeric NOT NULL,
  "updated_at"   numeric NOT NULL,
  "deleted_at"   numeric,
  "synced_at"    timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "store"."sales"
    ADD CONSTRAINT "sales_store_id_stores_id_fk"
    FOREIGN KEY ("store_id") REFERENCES "store"."stores"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "store"."sales"
    ADD CONSTRAINT "sales_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "store_sales_store_synced_idx"
  ON "store"."sales" USING btree ("store_id", "synced_at");
CREATE INDEX IF NOT EXISTS "store_sales_store_created_idx"
  ON "store"."sales" USING btree ("store_id", "created_at");
