-- Round 53 (Kadai on iPhone): a private link per shop that an iPhone Shortcuts automation
-- posts bank "money received" SMS text to. Only a hash of the link's secret is stored.
-- New table only, so it is safe to run before or after the code is deployed, and to re-run.

CREATE TABLE IF NOT EXISTS "store"."sms_ingest" (
  "store_id"         uuid PRIMARY KEY NOT NULL,
  "token_hash"       text NOT NULL,
  "last_received_at" numeric,
  "created_at"       timestamp NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "store"."sms_ingest"
    ADD CONSTRAINT "sms_ingest_store_id_stores_id_fk"
    FOREIGN KEY ("store_id") REFERENCES "store"."stores"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "sms_ingest_token_hash_idx"
  ON "store"."sms_ingest" USING btree ("token_hash");
