-- Round 24 (super-admin console): store lifecycle status.
--   'active' | 'trial' | 'suspended'
-- A 'suspended' store loses stocking access (sync + all /api/stocking/*)
-- without its data being touched. Set from the admin console. Safe to re-run.

ALTER TABLE "store"."stores"
  ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active';
