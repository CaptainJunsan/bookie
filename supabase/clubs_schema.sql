-- ─────────────────────────────────────────────────────────────────────────────
-- Bookie — Reading Clubs feature schema
-- Run this AFTER the base schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Add display_name to families (used for club/admin display; falls back to name)
ALTER TABLE families ADD COLUMN IF NOT EXISTS display_name text;

-- ── clubs ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clubs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  description   text,
  emoji         text NOT NULL DEFAULT '📖',
  is_public     boolean NOT NULL DEFAULT true,
  invite_token  text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by    uuid REFERENCES family_members(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── club_members ─────────────────────────────────────────────────────────────
-- role: 'owner' | 'admin' | 'member'
CREATE TABLE IF NOT EXISTS club_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id          uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  family_member_id uuid NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  role             text NOT NULL DEFAULT 'member',
  joined_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id, family_member_id)
);

-- ── club_books ───────────────────────────────────────────────────────────────
-- Book metadata stored per-club (denormalized) to avoid cross-family FK issues.
-- When a club member tracks progress, the book is also upserted into their
-- family library (handled in app layer).
CREATE TABLE IF NOT EXISTS club_books (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title      text NOT NULL,
  author     text,
  isbn       text,
  cover_url  text,
  page_count integer,
  added_by   uuid REFERENCES family_members(id) ON DELETE SET NULL,
  added_at   timestamptz NOT NULL DEFAULT now()
);

-- ── club_reading_progress ────────────────────────────────────────────────────
-- Tracks each member's progress on a club book.
-- status: 'want_to_read' | 'reading' | 'finished'
-- On upsert the app also propagates to the family reading_progress table.
CREATE TABLE IF NOT EXISTS club_reading_progress (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_book_id  uuid NOT NULL REFERENCES club_books(id) ON DELETE CASCADE,
  member_id     uuid NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  current_page  integer NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'want_to_read',
  started_at    timestamptz,
  finished_at   timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_book_id, member_id)
);

-- ── club_notifications ───────────────────────────────────────────────────────
-- type: 'new_book' | 'new_member' | 'milestone' | 'invite'
CREATE TABLE IF NOT EXISTS club_notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  type       text NOT NULL,
  title      text NOT NULL,
  seen       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper functions
-- ─────────────────────────────────────────────────────────────────────────────

-- Returns all club IDs where the current user has at least one family_member enrolled
CREATE OR REPLACE FUNCTION get_my_club_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(ARRAY_AGG(DISTINCT cm.club_id), ARRAY[]::uuid[])
  FROM   club_members cm
  JOIN   family_members fm ON fm.id = cm.family_member_id
  WHERE  fm.user_id = auth.uid()
    OR   fm.family_id IN (
           SELECT family_id FROM family_members WHERE user_id = auth.uid()
         );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE clubs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_books             ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_reading_progress  ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_notifications     ENABLE ROW LEVEL SECURITY;

-- ── clubs policies ───────────────────────────────────────────────────────────

-- Anyone can read public clubs
CREATE POLICY "clubs_select_public" ON clubs
  FOR SELECT USING (is_public = true);

-- Members can read private clubs they belong to
CREATE POLICY "clubs_select_member" ON clubs
  FOR SELECT USING (id = ANY(get_my_club_ids()));

-- Authenticated users can create clubs
CREATE POLICY "clubs_insert" ON clubs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Owners (created_by member belongs to current user) can update
CREATE POLICY "clubs_update_owner" ON clubs
  FOR UPDATE USING (
    created_by IN (
      SELECT id FROM family_members WHERE user_id = auth.uid()
    )
  );

-- Owners can delete
CREATE POLICY "clubs_delete_owner" ON clubs
  FOR DELETE USING (
    created_by IN (
      SELECT id FROM family_members WHERE user_id = auth.uid()
    )
  );

-- ── club_members policies ─────────────────────────────────────────────────────

-- Members can see who else is in clubs they belong to, plus public club membership
CREATE POLICY "club_members_select" ON club_members
  FOR SELECT USING (
    club_id IN (
      SELECT id FROM clubs WHERE is_public = true
      UNION
      SELECT unnest(get_my_club_ids())
    )
  );

-- Anyone authenticated can join a public club or join via invite (token validated in app)
CREATE POLICY "club_members_insert" ON club_members
  FOR INSERT WITH CHECK (
    family_member_id IN (
      SELECT id FROM family_members WHERE family_id IN (
        SELECT family_id FROM family_members WHERE user_id = auth.uid()
      )
    )
  );

-- Members can update their own membership row (e.g. role promotion by owner — owner updates others)
CREATE POLICY "club_members_update" ON club_members
  FOR UPDATE USING (
    -- Allow if they are an owner/admin of this club
    club_id IN (
      SELECT club_id FROM club_members
      WHERE family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
        AND role IN ('owner','admin')
    )
    OR family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
  );

-- Members can leave; owners/admins can remove members
CREATE POLICY "club_members_delete" ON club_members
  FOR DELETE USING (
    family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
    OR club_id IN (
      SELECT club_id FROM club_members
      WHERE family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
        AND role IN ('owner','admin')
    )
  );

-- ── club_books policies ───────────────────────────────────────────────────────

CREATE POLICY "club_books_select" ON club_books
  FOR SELECT USING (
    club_id IN (
      SELECT id FROM clubs WHERE is_public = true
      UNION
      SELECT unnest(get_my_club_ids())
    )
  );

CREATE POLICY "club_books_insert" ON club_books
  FOR INSERT WITH CHECK (club_id = ANY(get_my_club_ids()));

CREATE POLICY "club_books_delete" ON club_books
  FOR DELETE USING (
    club_id IN (
      SELECT club_id FROM club_members
      WHERE family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
        AND role IN ('owner','admin')
    )
    OR added_by IN (SELECT id FROM family_members WHERE user_id = auth.uid())
  );

-- ── club_reading_progress policies ───────────────────────────────────────────

-- Club members can see all progress (for the club's books)
CREATE POLICY "club_rp_select" ON club_reading_progress
  FOR SELECT USING (
    club_book_id IN (
      SELECT id FROM club_books WHERE club_id = ANY(get_my_club_ids())
    )
  );

-- Members can insert/update their own progress
CREATE POLICY "club_rp_insert" ON club_reading_progress
  FOR INSERT WITH CHECK (
    member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
    OR member_id IN (
      SELECT id FROM family_members
      WHERE family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "club_rp_update" ON club_reading_progress
  FOR UPDATE USING (
    member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
    OR member_id IN (
      SELECT id FROM family_members
      WHERE family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    )
  );

-- ── club_notifications policies ───────────────────────────────────────────────

CREATE POLICY "club_notif_select" ON club_notifications
  FOR SELECT USING (
    member_id IN (
      SELECT id FROM family_members
      WHERE family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "club_notif_insert" ON club_notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "club_notif_update" ON club_notifications
  FOR UPDATE USING (
    member_id IN (
      SELECT id FROM family_members
      WHERE family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- RPCs for reports (security definer so they can join across families)
-- ─────────────────────────────────────────────────────────────────────────────

-- Returns per-member progress for a club, optionally filtered by member_id
CREATE OR REPLACE FUNCTION club_member_report(
  p_club_id   uuid,
  p_member_id uuid DEFAULT NULL
)
RETURNS TABLE (
  member_id        uuid,
  nickname         text,
  avatar_emoji     text,
  age_group        text,
  role             text,
  club_role        text,
  books_finished   bigint,
  books_reading    bigint,
  books_want       bigint,
  pages_read       bigint
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    fm.id,
    fm.nickname,
    fm.avatar_emoji,
    fm.age_group,
    fm.role,
    cm.role AS club_role,
    COUNT(crp.id) FILTER (WHERE crp.status = 'finished')      AS books_finished,
    COUNT(crp.id) FILTER (WHERE crp.status = 'reading')       AS books_reading,
    COUNT(crp.id) FILTER (WHERE crp.status = 'want_to_read')  AS books_want,
    COALESCE(SUM(crp.current_page), 0)                        AS pages_read
  FROM club_members cm
  JOIN family_members fm ON fm.id = cm.family_member_id
  LEFT JOIN club_reading_progress crp ON crp.member_id = fm.id
    AND crp.club_book_id IN (SELECT id FROM club_books WHERE club_id = p_club_id)
  WHERE cm.club_id = p_club_id
    AND (p_member_id IS NULL OR fm.id = p_member_id)
  GROUP BY fm.id, fm.nickname, fm.avatar_emoji, fm.age_group, fm.role, cm.role;
$$;

-- Returns per-book progress for a club
CREATE OR REPLACE FUNCTION club_books_report(p_club_id uuid)
RETURNS TABLE (
  book_id        uuid,
  title          text,
  author         text,
  isbn           text,
  cover_url      text,
  page_count     integer,
  finished_count bigint,
  reading_count  bigint,
  want_count     bigint,
  avg_page       numeric
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    cb.id,
    cb.title,
    cb.author,
    cb.isbn,
    cb.cover_url,
    cb.page_count,
    COUNT(crp.id) FILTER (WHERE crp.status = 'finished')     AS finished_count,
    COUNT(crp.id) FILTER (WHERE crp.status = 'reading')      AS reading_count,
    COUNT(crp.id) FILTER (WHERE crp.status = 'want_to_read') AS want_count,
    ROUND(AVG(crp.current_page), 0)                          AS avg_page
  FROM club_books cb
  LEFT JOIN club_reading_progress crp ON crp.club_book_id = cb.id
  WHERE cb.club_id = p_club_id
  GROUP BY cb.id, cb.title, cb.author, cb.isbn, cb.cover_url, cb.page_count
  ORDER BY cb.added_at;
$$;
