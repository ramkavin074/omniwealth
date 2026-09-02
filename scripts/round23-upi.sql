-- Round 23 (UPI reconciliation): store.upi_receipts — money actually received
-- over UPI, matched against upi/split sales by amount + time. Owner/manager
-- writes; synced like the other store rows. Safe to re-run.

CREATE TABLE IF NOT EXISTS "store"."upi_receipts" (
  "id"              uuid PRIMARY KEY NOT NULL,
  "store_id"        uuid NOT NULL,
  "user_id"         uuid,
  "amount"          numeric NOT NULL,
  "received_at"     numeric NOT NULL,
  "ref"             text,
  "payer_name"      text,
  "source"          text NOT NULL DEFAULT 'manual',
  "matched_sale_id" uuid,
  "note"            text,
  "updated_at"      numeric NOT NULL,
  "deleted_at"      numeric,
  "synced_at"       timestamp NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "store"."upi_receipts"
    ADD CONSTRAINT "upi_receipts_store_id_stores_id_fk"
    FOREIGN KEY ("store_id") REFERENCES "store"."stores"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "store"."upi_receipts"
    ADD CONSTRAINT "upi_receipts_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "store_upi_receipts_store_synced_idx"
  ON "store"."upi_receipts" USING btree ("store_id", "synced_at");
