-- ─────────────────────────────────────────────────────────────────────────────
-- Bookie — Topics & Comments schema
-- Run this AFTER clubs_schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Add club_type, commenting_enabled, profanity_filter to clubs
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS club_type text NOT NULL DEFAULT 'educational';
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS commenting_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS profanity_filter boolean NOT NULL DEFAULT true;

-- ── club_topics ───────────────────────────────────────────────────────────────
-- Discussion threads posted by owners (highlighted) or admins.
-- commenting_allowed can be set per-topic to override the club-wide default.
CREATE TABLE IF NOT EXISTS club_topics (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  club_book_id        uuid REFERENCES club_books(id) ON DELETE SET NULL,
  created_by          uuid NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  title               text NOT NULL,
  body                text,
  commenting_allowed  boolean NOT NULL DEFAULT true,
  profanity_filter    boolean NOT NULL DEFAULT true,
  is_pinned           boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── club_topic_comments ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS club_topic_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id    uuid NOT NULL REFERENCES club_topics(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  body        text NOT NULL,
  is_deleted  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── club_comment_blocks ───────────────────────────────────────────────────────
-- Owner can block a specific member from commenting in the club.
CREATE TABLE IF NOT EXISTS club_comment_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  blocked_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id, member_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE club_topics          ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_topic_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_comment_blocks  ENABLE ROW LEVEL SECURITY;

-- ── club_topics policies ──────────────────────────────────────────────────────

-- Club members can read topics
CREATE POLICY "topics_select" ON club_topics
  FOR SELECT USING (club_id = ANY(get_my_club_ids()));

-- Only owners/admins can create topics
CREATE POLICY "topics_insert" ON club_topics
  FOR INSERT WITH CHECK (
    club_id IN (
      SELECT club_id FROM club_members
      WHERE family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
        AND role IN ('owner', 'admin')
    )
    AND created_by IN (SELECT id FROM family_members WHERE user_id = auth.uid())
  );

-- Owners/admins can update topics (pin, toggle commenting)
CREATE POLICY "topics_update" ON club_topics
  FOR UPDATE USING (
    club_id IN (
      SELECT club_id FROM club_members
      WHERE family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
        AND role IN ('owner', 'admin')
    )
  );

-- Owners/admins can delete topics
CREATE POLICY "topics_delete" ON club_topics
  FOR DELETE USING (
    club_id IN (
      SELECT club_id FROM club_members
      WHERE family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
        AND role IN ('owner', 'admin')
    )
  );

-- ── club_topic_comments policies ─────────────────────────────────────────────

-- Club members can read comments (even soft-deleted ones show as "[removed]")
CREATE POLICY "comments_select" ON club_topic_comments
  FOR SELECT USING (
    topic_id IN (SELECT id FROM club_topics WHERE club_id = ANY(get_my_club_ids()))
  );

-- Authenticated club members can comment
CREATE POLICY "comments_insert" ON club_topic_comments
  FOR INSERT WITH CHECK (
    author_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
    AND topic_id IN (SELECT id FROM club_topics WHERE club_id = ANY(get_my_club_ids()))
  );

-- Owners/admins can soft-delete any comment; authors can delete their own
CREATE POLICY "comments_update" ON club_topic_comments
  FOR UPDATE USING (
    author_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
    OR topic_id IN (
      SELECT t.id FROM club_topics t
      JOIN club_members cm ON cm.club_id = t.club_id
      WHERE cm.family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
        AND cm.role IN ('owner', 'admin')
    )
  );

-- ── club_comment_blocks policies ─────────────────────────────────────────────

CREATE POLICY "blocks_select" ON club_comment_blocks
  FOR SELECT USING (
    club_id = ANY(get_my_club_ids())
  );

-- Only owners/admins can block
CREATE POLICY "blocks_insert" ON club_comment_blocks
  FOR INSERT WITH CHECK (
    club_id IN (
      SELECT club_id FROM club_members
      WHERE family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
        AND role IN ('owner', 'admin')
    )
  );

-- Owners/admins can unblock
CREATE POLICY "blocks_delete" ON club_comment_blocks
  FOR DELETE USING (
    club_id IN (
      SELECT club_id FROM club_members
      WHERE family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
        AND role IN ('owner', 'admin')
    )
  );
