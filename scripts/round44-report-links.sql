-- Read-only report links (share a net-worth summary with e.g. an accountant).
-- Only the SHA-256 hash of each link token is stored.
CREATE TABLE IF NOT EXISTS report_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  token_hash      text NOT NULL UNIQUE,
  label           text,
  expires_at      timestamp NOT NULL,
  revoked_at      timestamp,
  view_count      integer NOT NULL DEFAULT 0,
  last_viewed_at  timestamp,
  created_at      timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_links_household_idx ON report_links (household_id);
