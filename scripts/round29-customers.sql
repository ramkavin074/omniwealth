-- Round 29 (C1): credit / khata customers + receipts.
-- Client-generated UUID PKs, epoch-ms updated_at LWW, deleted_at tombstones,
-- server synced_at as the pull cursor — same contract as the other synced
-- store.* tables. Balance is derived on the client, never stored.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS "store"."customers" (
  "id"              uuid PRIMARY KEY NOT NULL,
  "store_id"        uuid NOT NULL REFERENCES "store"."stores"("id") ON DELETE CASCADE,
  "name"            text NOT NULL,
  "phone"           text,
  "place"           text,
  "gstin"           text,
  "credit_limit"    numeric NOT NULL DEFAULT '0',
  "opening_balance" numeric NOT NULL DEFAULT '0',
  "note"            text,
  "updated_at"      numeric NOT NULL,
  "deleted_at"      numeric,
  "synced_at"       timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "store_customers_store_synced_idx"
  ON "store"."customers" USING btree ("store_id", "synced_at");

CREATE TABLE IF NOT EXISTS "store"."receipts" (
  "id"              uuid PRIMARY KEY NOT NULL,
  "store_id"        uuid NOT NULL REFERENCES "store"."stores"("id") ON DELETE CASCADE,
  "customer_id"     uuid NOT NULL,
  "amount"          numeric NOT NULL,
  "tender"          text NOT NULL DEFAULT 'cash',
  "against_bill_id" uuid,
  "note"            text,
  "received_at"     numeric NOT NULL,
  "updated_at"      numeric NOT NULL,
  "deleted_at"      numeric,
  "synced_at"       timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "store_receipts_store_synced_idx"
  ON "store"."receipts" USING btree ("store_id", "synced_at");
CREATE INDEX IF NOT EXISTS "store_receipts_customer_idx"
  ON "store"."receipts" USING btree ("customer_id");

ALTER TABLE "store"."sales"
  ADD COLUMN IF NOT EXISTS "customer_id" uuid;
