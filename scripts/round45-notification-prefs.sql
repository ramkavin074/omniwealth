-- Per-user notification preferences (currently: net-worth move push alerts).
-- No row = defaults (alerts on). Safe to run more than once.
CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id            uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  net_worth_alerts   boolean NOT NULL DEFAULT true,
  updated_at         timestamp NOT NULL DEFAULT now()
);
