-- Round 52 (Kadai): wholesale price + "buy N get M free" scheme on products,
-- a wholesale flag on customers, and the day-close (cash book) table.
-- Safe to run more than once, and safe to run before the new code is deployed
-- (nothing reads these until then).

ALTER TABLE store.products  ADD COLUMN IF NOT EXISTS wholesale_price numeric NOT NULL DEFAULT '0';
ALTER TABLE store.products  ADD COLUMN IF NOT EXISTS scheme_buy      numeric NOT NULL DEFAULT '0';
ALTER TABLE store.products  ADD COLUMN IF NOT EXISTS scheme_free     numeric NOT NULL DEFAULT '0';
ALTER TABLE store.customers ADD COLUMN IF NOT EXISTS wholesale       boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "store"."day_closes" (
  "id"            uuid PRIMARY KEY NOT NULL,
  "store_id"      uuid NOT NULL,
  "user_id"       uuid,
  "date"          text NOT NULL,
  "opening_cash"  numeric NOT NULL DEFAULT '0',
  "cash_sales"    numeric NOT NULL DEFAULT '0',
  "cash_received" numeric NOT NULL DEFAULT '0',
  "cash_expenses" numeric NOT NULL DEFAULT '0',
  "other_paid_out" numeric NOT NULL DEFAULT '0',
  "expected_cash" numeric NOT NULL DEFAULT '0',
  "counted_cash"  numeric NOT NULL DEFAULT '0',
  "difference"    numeric NOT NULL DEFAULT '0',
  "note"          text,
  "created_at"    numeric NOT NULL,
  "updated_at"    numeric NOT NULL,
  "deleted_at"    numeric,
  "synced_at"     timestamp NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "store"."day_closes"
    ADD CONSTRAINT "day_closes_store_id_stores_id_fk"
    FOREIGN KEY ("store_id") REFERENCES "store"."stores"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "store"."day_closes"
    ADD CONSTRAINT "day_closes_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "store_day_closes_store_synced_idx"
  ON "store"."day_closes" USING btree ("store_id", "synced_at");
