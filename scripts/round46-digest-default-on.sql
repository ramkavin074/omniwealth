-- New accounts get the weekly email digest ON by default (the app code now sets
-- it explicitly; this also makes the column default match).
ALTER TABLE users ALTER COLUMN email_digest SET DEFAULT true;

-- OPTIONAL, separate decision: also switch it on for EXISTING accounts that
-- never touched the setting. Only do this if you're comfortable emailing them
-- without their having opted in (each digest says how to turn it off).
-- UPDATE users SET email_digest = true
--   WHERE email_digest = false
--     AND household_id IN (SELECT id FROM households WHERE is_store_shell = false);
