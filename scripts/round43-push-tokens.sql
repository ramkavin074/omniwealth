-- Round 43: push notification device tokens (one row per user + device).
-- Registered by the native app after the user grants notification permission.

CREATE TABLE IF NOT EXISTS push_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform    text NOT NULL,                 -- 'ios' | 'android' | 'web'
  token       text NOT NULL UNIQUE,
  created_at  timestamp NOT NULL DEFAULT now(),
  updated_at  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON push_tokens (user_id);
