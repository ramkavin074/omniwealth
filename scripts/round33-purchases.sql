-- Round 33 (C5): supplier / inward invoices with GST input credit.
-- Lines restock via the movement ledger; the GST portion is claimable ITC.
-- Same synced contract as the other store.* tables. Safe to re-run.

CREATE TABLE IF NOT EXISTS "store"."purchases" (
  "id"            uuid PRIMARY KEY NOT NULL,
  "store_id"      uuid NOT NULL REFERENCES "store"."stores"("id") ON DELETE CASCADE,
  "invoice_no"    text NOT NULL DEFAULT '',
  "supplier_id"   uuid NOT NULL,
  "supplier_name" text NOT NULL,
  "invoice_date"  text,
  "lines"         jsonb NOT NULL DEFAULT '[]',
  "subtotal"      numeric NOT NULL DEFAULT '0',
  "gst_input"     numeric NOT NULL DEFAULT '0',
  "total"         numeric NOT NULL DEFAULT '0',
  "paid"          numeric NOT NULL DEFAULT '0',
  "note"          text,
  "received_at"   numeric NOT NULL,
  "created_at"    numeric NOT NULL,
  "updated_at"    numeric NOT NULL,
  "deleted_at"    numeric,
  "synced_at"     timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "store_purchases_store_synced_idx"
  ON "store"."purchases" USING btree ("store_id", "synced_at");
CREATE INDEX IF NOT EXISTS "store_purchases_supplier_idx"
  ON "store"."purchases" USING btree ("supplier_id");
