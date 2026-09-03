-- Round 32 (C4): billing depth — card tender + salesman tag on sales.
-- Per-line discount lives inside the existing sales.items jsonb, no column.
-- Safe to re-run.

ALTER TABLE "store"."sales"
  ADD COLUMN IF NOT EXISTS "card_amount" numeric NOT NULL DEFAULT '0';
ALTER TABLE "store"."sales"
  ADD COLUMN IF NOT EXISTS "salesman" text;
