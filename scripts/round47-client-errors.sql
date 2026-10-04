-- First-party error reports from the web app and the native apps' WebView.
-- Pruned after 30 days by /api/cron/cleanup. Safe to run more than once.
CREATE TABLE IF NOT EXISTS client_errors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamp NOT NULL DEFAULT now(),
  kind        text NOT NULL,
  message     text NOT NULL,
  stack       text,
  path        text,
  platform    text,
  app_version text,
  user_agent  text,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS client_errors_created_idx ON client_errors (created_at);
