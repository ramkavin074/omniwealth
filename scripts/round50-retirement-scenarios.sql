CREATE TABLE IF NOT EXISTS retirement_scenarios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name          text NOT NULL,
  config        text NOT NULL,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS retirement_scenarios_household_idx ON retirement_scenarios (household_id);
