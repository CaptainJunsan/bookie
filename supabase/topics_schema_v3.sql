-- ─────────────────────────────────────────────────────────────────────────────
-- Bookie — Topics schema v3: threads_allowed per-topic control
-- Run AFTER topics_schema_v2.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- When false: members can post top-level comments but the Reply button is hidden.
-- Owners can still reply at any depth regardless of this setting.
ALTER TABLE club_topics
  ADD COLUMN IF NOT EXISTS threads_allowed boolean NOT NULL DEFAULT true;
