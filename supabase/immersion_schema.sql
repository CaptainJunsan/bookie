-- Immersion mode switch (PRD v0.3 §5.2)
-- Run manually against production on 2026-09-23. Recorded here for the history —
-- confirm this matches the live schema before writing further migrations against it.

-- Add immersion_enabled (PRD §5.2)
ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS immersion_enabled boolean;

-- Seed defaults from existing age_group values
UPDATE family_members SET immersion_enabled = CASE
  WHEN age_group IN ('3-5', '6-9', '10-12') THEN true
  WHEN age_group IN ('0-2', '13-17', '18-21', '22-35', '36-65', '66+', 'prefer_not_to_say') THEN false
  -- Old bands: best-guess defaults
  WHEN age_group = '10-15' THEN true   -- was mid-range, lean toward Navigator (on)
  WHEN age_group = '16-21' THEN false  -- was teen/young adult, lean toward Traveller (off)
  ELSE false
END
WHERE immersion_enabled IS NULL;
