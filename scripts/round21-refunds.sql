-- Round 21 (billing B4): customer refunds.
-- A refund is a store.sales row with `refund_of` set to the original sale id
-- and negative amounts (items, total, tax). Stock goes back via a
-- `sale-return` movement. No new table. Safe to re-run.

ALTER TABLE "store"."sales" ADD COLUMN IF NOT EXISTS "refund_of" uuid;
