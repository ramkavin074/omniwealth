-- Read-only keys for the Home Screen widget's background refresh.
-- Only a hash of each key is stored. Safe to run more than once.
CREATE TABLE IF NOT EXISTS widget_keys (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id       uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  key_hash           text NOT NULL UNIQUE,
  session_token_hash text,
  label              text,
  created_at         timestamp NOT NULL DEFAULT now(),
  last_used_at       timestamp,
  expires_at         timestamp NOT NULL,
  revoked_at         timestamp
);
CREATE INDEX IF NOT EXISTS widget_keys_user_idx ON widget_keys (user_id);
