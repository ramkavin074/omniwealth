-- Round 31 (C3): shop running-cost expenses (rent, power, wages, transport…).
-- NOT stock purchases — those stay in store.supplier_payments. Same synced
-- contract as the other store.* tables. Safe to re-run.

CREATE TABLE IF NOT EXISTS "store"."expenses" (
  "id"          uuid PRIMARY KEY NOT NULL,
  "store_id"    uuid NOT NULL REFERENCES "store"."stores"("id") ON DELETE CASCADE,
  "category"    text NOT NULL DEFAULT 'other',
  "amount"      numeric NOT NULL,
  "tender"      text NOT NULL DEFAULT 'cash',
  "payee"       text,
  "note"        text,
  "gst_input"   numeric NOT NULL DEFAULT '0',
  "spent_at"    numeric NOT NULL,
  "created_at"  numeric NOT NULL,
  "updated_at"  numeric NOT NULL,
  "deleted_at"  numeric,
  "synced_at"   timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "store_expenses_store_synced_idx"
  ON "store"."expenses" USING btree ("store_id", "synced_at");
