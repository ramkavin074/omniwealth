-- Round 13: low-stock WhatsApp alert recipient per store.
-- The daily cron (/api/cron/stocking-low-stock) reads store.stores.alert_phone
-- and skips any store where it is NULL. Owner/manager sets it in Settings.
-- Safe to re-run.

ALTER TABLE store.stores ADD COLUMN IF NOT EXISTS alert_phone text;
