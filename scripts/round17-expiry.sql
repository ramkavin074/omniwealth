-- Round 17: per-product expiry date.
-- store.products.expiry_date holds the current batch's date as 'YYYY-MM-DD'
-- (text, so it sorts and compares directly). NULL = the shop doesn't track
-- an expiry for this item. The daily alert cron and the app's "Expiring"
-- views read it. Safe to re-run.

ALTER TABLE store.products ADD COLUMN IF NOT EXISTS expiry_date text;
