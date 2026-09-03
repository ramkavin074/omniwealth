-- Round 30 (C2): advance-booked orders / job-work.
-- Same synced-table contract as the other store.* tables. Balance due is
-- derived on the client (total − advance_paid). Safe to re-run.

CREATE TABLE IF NOT EXISTS "store"."orders" (
  "id"            uuid PRIMARY KEY NOT NULL,
  "store_id"      uuid NOT NULL REFERENCES "store"."stores"("id") ON DELETE CASCADE,
  "order_no"      text NOT NULL,
  "customer_id"   uuid NOT NULL,
  "customer_name" text NOT NULL,
  "lines"         jsonb NOT NULL DEFAULT '[]',
  "total"         numeric NOT NULL DEFAULT '0',
  "advance_paid"  numeric NOT NULL DEFAULT '0',
  "status"        text NOT NULL DEFAULT 'booked',
  "due_date"      text,
  "note"          text,
  "bill_id"       uuid,
  "created_at"    numeric NOT NULL,
  "updated_at"    numeric NOT NULL,
  "deleted_at"    numeric,
  "synced_at"     timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "store_orders_store_synced_idx"
  ON "store"."orders" USING btree ("store_id", "synced_at");
CREATE INDEX IF NOT EXISTS "store_orders_customer_idx"
  ON "store"."orders" USING btree ("customer_id");

ALTER TABLE "store"."receipts"
  ADD COLUMN IF NOT EXISTS "against_order_id" uuid;
