-- ─────────────────────────────────────────────────────────────────────────────
-- Bookie — reading_sessions (PRD §6.2, §22.1 slice 1)
-- The top-priority blocking item identified across every version of the PRD:
-- re-reads, read-aloud tagging, and (later) the Home timer all depend on this.
--
-- One row per read-event, not a column on reading_progress. Backfilled from
-- existing reading_progress.status='finished' rows so "books finished" totals
-- computed from this table going forward are continuous with history, not a
-- regression. reading_progress keeps its job (current want/reading/finished
-- status + page); reading_sessions is the append-only log underneath it.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reading_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id          uuid NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  book_id            uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  started_at         timestamptz NOT NULL DEFAULT now(),
  ended_at           timestamptz,
  duration_seconds   integer,
  source             text NOT NULL DEFAULT 'manual', -- 'manual' | 'reader' | 'class'
  is_read_aloud      boolean NOT NULL DEFAULT false,  -- "read to me" — counts toward time, not toward books finished
  is_completion      boolean NOT NULL DEFAULT false,  -- this session finished the book — a "read", including re-reads
  logged_by_member_id uuid REFERENCES family_members(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reading_sessions_member_idx ON reading_sessions(member_id);
CREATE INDEX IF NOT EXISTS reading_sessions_book_idx ON reading_sessions(book_id);

-- ── Backfill ─────────────────────────────────────────────────────────────────
-- One completion session per existing finished book, so counts computed from
-- reading_sessions going forward match what reading_progress already showed.
-- Guarded so this migration file is safe to re-run.
INSERT INTO reading_sessions (member_id, book_id, started_at, ended_at, source, is_completion, logged_by_member_id, created_at)
SELECT
  rp.member_id,
  rp.book_id,
  COALESCE(rp.finished_at, rp.updated_at),
  COALESCE(rp.finished_at, rp.updated_at),
  'manual',
  true,
  rp.member_id,
  COALESCE(rp.finished_at, rp.updated_at)
FROM reading_progress rp
WHERE rp.status = 'finished'
  AND NOT EXISTS (
    SELECT 1 FROM reading_sessions rs
    WHERE rs.member_id = rp.member_id AND rs.book_id = rp.book_id AND rs.is_completion = true
  );

-- ── RLS — mirrors reading_progress exactly ──────────────────────────────────
ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Insert reading sessions" ON reading_sessions;
CREATE POLICY "Insert reading sessions" ON reading_sessions
  FOR INSERT WITH CHECK (
    member_id IN (SELECT id FROM family_members WHERE family_id = get_my_family_id())
  );

DROP POLICY IF EXISTS "Update reading sessions" ON reading_sessions;
CREATE POLICY "Update reading sessions" ON reading_sessions
  FOR UPDATE USING (
    member_id IN (SELECT id FROM family_members WHERE family_id = get_my_family_id())
  );

DROP POLICY IF EXISTS "View reading sessions" ON reading_sessions;
CREATE POLICY "View reading sessions" ON reading_sessions
  FOR SELECT USING (
    member_id IN (SELECT id FROM family_members WHERE family_id = get_my_family_id())
  );
