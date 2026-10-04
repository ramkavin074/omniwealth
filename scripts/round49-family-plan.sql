-- Family plan + timeline: renewal/maturity reminders, people to call, and
-- wealth-chart event markers. Safe to re-run.
CREATE TABLE IF NOT EXISTS household_reminders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title         text NOT NULL,
  kind          text NOT NULL DEFAULT 'other',
  due_date      date NOT NULL,
  repeat_yearly boolean NOT NULL DEFAULT false,
  note          text,
  done_at       timestamp,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS household_reminders_household_idx ON household_reminders (household_id);

CREATE TABLE IF NOT EXISTS household_contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name          text NOT NULL,
  role          text NOT NULL DEFAULT 'Other',
  phone         text,
  email         text,
  note          text,
  is_legacy     boolean NOT NULL DEFAULT false,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS household_contacts_household_idx ON household_contacts (household_id);

CREATE TABLE IF NOT EXISTS timeline_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  event_date    date NOT NULL,
  label         text NOT NULL,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS timeline_events_household_idx ON timeline_events (household_id);
