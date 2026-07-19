-- ─────────────────────────────────────────────────────────────────────────────
-- Bookie — Clubs schema patch (run after clubs_schema.sql)
-- ─────────────────────────────────────────────────────────────────────────────

-- Allow club members to view each other's family_member profiles.
-- Without this, the family_members join returns null for members from
-- other families due to the existing RLS "View family members" policy.
-- Note: DROP before CREATE because PostgreSQL does not support IF NOT EXISTS for policies.
DROP POLICY IF EXISTS "View fellow club members" ON family_members;
CREATE POLICY "View fellow club members" ON family_members
  FOR SELECT USING (
    id IN (
      SELECT family_member_id FROM club_members
      WHERE club_id = ANY(get_my_club_ids())
    )
  );

-- Group Read support: mark a club book as the current group read with an
-- optional target finish date.
ALTER TABLE club_books
  ADD COLUMN IF NOT EXISTS is_current_read boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS read_target_date date;

-- UPDATE policy for club_books (needed for Group Read feature — owners/admins only)
DROP POLICY IF EXISTS "club_books_update" ON club_books;
CREATE POLICY "club_books_update" ON club_books
  FOR UPDATE USING (
    club_id IN (
      SELECT club_id FROM club_members
      WHERE family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
        AND role IN ('owner', 'admin')
    )
  );
