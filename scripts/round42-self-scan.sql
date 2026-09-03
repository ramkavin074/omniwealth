-- Round 42: customer self-scan basket.
-- Additive + reversible. Run in the Neon SQL editor, then deploy.

ALTER TABLE "store"."stores"
  ADD COLUMN IF NOT EXISTS "self_scan_enabled" boolean NOT NULL DEFAULT false;

ALTER TABLE "store"."stores"
  ADD COLUMN IF NOT EXISTS "upi_id" text;

CREATE TABLE IF NOT EXISTS "store"."baskets" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "store_id"   uuid NOT NULL REFERENCES "store"."stores"("id") ON DELETE CASCADE,
  "code"       text NOT NULL,
  "items"      jsonb NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "claimed_at" timestamp,
  "expires_at" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "store_baskets_store_code_idx"
  ON "store"."baskets" ("store_id", "code");
