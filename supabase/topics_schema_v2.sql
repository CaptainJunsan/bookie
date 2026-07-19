-- ─────────────────────────────────────────────────────────────────────────────
-- Bookie — Topics schema v2: nested threading
-- Run AFTER topics_schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Add parent_id for threaded replies (self-referential; null = root comment)
ALTER TABLE club_topic_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES club_topic_comments(id) ON DELETE CASCADE;
