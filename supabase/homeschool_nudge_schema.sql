-- Homeschooling nudge (PRD §22.1 slice 5): shown on the school-registration
-- step, points homeschoolers at a Reading Club instead of registering a
-- school. The "started" tag persists so the nudge/tutorial can be resumed on
-- return visits; "dismissed" is permanent once the user closes it for good.
ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS homeschool_journey_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS homeschool_nudge_dismissed boolean NOT NULL DEFAULT false;
