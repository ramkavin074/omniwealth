-- Round 41: phone-number loyalty points on khata customers.
-- Additive + reversible. Run in the Neon SQL editor, then deploy.

ALTER TABLE "store"."customers"
  ADD COLUMN IF NOT EXISTS "loyalty_points" numeric NOT NULL DEFAULT '0';
