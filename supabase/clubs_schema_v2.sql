-- ─────────────────────────────────────────────────────────────────────────────
-- Bookie — Clubs schema v2 patch
-- Run after clubs_schema.sql and clubs_schema_patch.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Location fields on clubs ──────────────────────────────────────────────────
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS city   text;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS suburb text;

-- ── Reading groups (sub-groups within a club) ─────────────────────────────────
-- Examples: "Little Readers (0–3)", "Junior Chapter Books (6–9)", "Adult Fiction"
CREATE TABLE IF NOT EXISTS reading_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  age_min     integer,
  age_max     integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Assign club members to reading groups (one member can belong to multiple groups)
CREATE TABLE IF NOT EXISTS reading_group_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_group_id uuid NOT NULL REFERENCES reading_groups(id) ON DELETE CASCADE,
  club_member_id   uuid NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  UNIQUE(reading_group_id, club_member_id)
);

-- Optional: scope a club book to a specific reading group (NULL = whole club)
ALTER TABLE club_books ADD COLUMN IF NOT EXISTS reading_group_id uuid REFERENCES reading_groups(id) ON DELETE SET NULL;

-- ── Join requests ─────────────────────────────────────────────────────────────
-- Browse/search joins create a pending request; invite-link joins bypass this.
CREATE TABLE IF NOT EXISTS club_join_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id          uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  family_member_id uuid NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  message          text,
  requested_at     timestamptz NOT NULL DEFAULT now(),
  reviewed_at      timestamptz,
  reviewed_by      uuid REFERENCES family_members(id) ON DELETE SET NULL,
  UNIQUE(club_id, family_member_id)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE reading_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_join_requests    ENABLE ROW LEVEL SECURITY;

-- reading_groups: visible to all club members (and public club viewers)
DROP POLICY IF EXISTS "reading_groups_select" ON reading_groups;
CREATE POLICY "reading_groups_select" ON reading_groups
  FOR SELECT USING (
    club_id IN (
      SELECT id FROM clubs WHERE is_public = true
      UNION
      SELECT unnest(get_my_club_ids())
    )
  );

DROP POLICY IF EXISTS "reading_groups_insert" ON reading_groups;
CREATE POLICY "reading_groups_insert" ON reading_groups
  FOR INSERT WITH CHECK (club_id = ANY(get_my_club_ids()));

DROP POLICY IF EXISTS "reading_groups_update" ON reading_groups;
CREATE POLICY "reading_groups_update" ON reading_groups
  FOR UPDATE USING (
    club_id IN (
      SELECT club_id FROM club_members
      WHERE family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
        AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "reading_groups_delete" ON reading_groups;
CREATE POLICY "reading_groups_delete" ON reading_groups
  FOR DELETE USING (
    club_id IN (
      SELECT club_id FROM club_members
      WHERE family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
        AND role IN ('owner', 'admin')
    )
  );

-- reading_group_members: visible to club members
DROP POLICY IF EXISTS "rgm_select" ON reading_group_members;
CREATE POLICY "rgm_select" ON reading_group_members
  FOR SELECT USING (
    reading_group_id IN (
      SELECT id FROM reading_groups WHERE club_id = ANY(get_my_club_ids())
    )
  );

DROP POLICY IF EXISTS "rgm_insert" ON reading_group_members;
CREATE POLICY "rgm_insert" ON reading_group_members
  FOR INSERT WITH CHECK (
    reading_group_id IN (
      SELECT id FROM reading_groups
      WHERE club_id IN (
        SELECT club_id FROM club_members
        WHERE family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
          AND role IN ('owner', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "rgm_delete" ON reading_group_members;
CREATE POLICY "rgm_delete" ON reading_group_members
  FOR DELETE USING (
    reading_group_id IN (
      SELECT id FROM reading_groups
      WHERE club_id IN (
        SELECT club_id FROM club_members
        WHERE family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
          AND role IN ('owner', 'admin')
      )
    )
  );

-- club_join_requests: requester sees their own; club owners/admins see all for their clubs
DROP POLICY IF EXISTS "cjr_select" ON club_join_requests;
CREATE POLICY "cjr_select" ON club_join_requests
  FOR SELECT USING (
    family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
    OR club_id IN (
      SELECT club_id FROM club_members
      WHERE family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
        AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "cjr_insert" ON club_join_requests;
CREATE POLICY "cjr_insert" ON club_join_requests
  FOR INSERT WITH CHECK (
    family_member_id IN (
      SELECT id FROM family_members
      WHERE family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "cjr_update" ON club_join_requests;
CREATE POLICY "cjr_update" ON club_join_requests
  FOR UPDATE USING (
    -- Only owners/admins can approve/reject
    club_id IN (
      SELECT club_id FROM club_members
      WHERE family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
        AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "cjr_delete" ON club_join_requests;
CREATE POLICY "cjr_delete" ON club_join_requests
  FOR DELETE USING (
    -- Requester can withdraw; owners/admins can clear
    family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
    OR club_id IN (
      SELECT club_id FROM club_members
      WHERE family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
        AND role IN ('owner', 'admin')
    )
  );
