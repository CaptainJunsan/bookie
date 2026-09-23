-- Per-profile language preference (PRD v0.3 §9.2)
-- Run manually against production on 2026-09-23. Recorded here for the history —
-- confirm this matches the live schema before writing further migrations against it.

ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en'
  CHECK (language IN ('en', 'af', 'xh'));
