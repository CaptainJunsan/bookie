-- Multi-family membership (PRD §23.2 / §27)
--
-- A person can now have more than one family_members row (same user_id,
-- different family_id) — each profile independently scoped to that family's
-- books/reading_progress/ratings/reading_sessions, exactly as a single-family
-- profile always was. Nothing in the schema actually prevented this before;
-- it was blocked only by app code (AuthContext's .single() query assumed one
-- row per user_id) and RLS (get_my_family_id() picked an arbitrary one via
-- LIMIT 1). This migration doesn't restructure anything — it's additive.

-- ── Column ───────────────────────────────────────────────────────────────

-- Which of a user's family_members rows is their default/billing family.
-- DEFAULT true backfills every existing row correctly with no separate
-- UPDATE (today every row IS someone's only family, so it's definitionally
-- primary), and makes the failure mode loud rather than silent: an insert
-- that forgets to set is_primary:false for a second family hits the unique
-- index below immediately instead of leaving a user with zero primaries.
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT true;

-- NULLs (every child row — no user_id) don't conflict with each other in a
-- unique index, so this only constrains adult rows with a real account.
CREATE UNIQUE INDEX IF NOT EXISTS family_members_one_primary_per_user ON family_members(user_id) WHERE is_primary = true;

-- ── Function ─────────────────────────────────────────────────────────────

-- Plural counterpart to get_my_family_id() (left in place, unused, per the
-- established "never DROP, build new" pattern for this environment — see
-- schools_schema_v3.sql). Every RLS policy that gated on "= get_my_family_id()"
-- moves to "= ANY (get_my_family_ids())" so a person can see/use ALL of
-- their families' data via RLS; the app's own queries (always filtered by
-- whichever family is currently active in AuthContext) still control what's
-- actually shown at any moment.
CREATE OR REPLACE FUNCTION get_my_family_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(ARRAY_AGG(family_id), ARRAY[]::uuid[])
  FROM family_members
  WHERE user_id = auth.uid();
$$;

-- ── RLS policy updates ───────────────────────────────────────────────────
-- ALTER POLICY (not DROP + CREATE) — changes the USING/WITH CHECK expression
-- in place. 23 policies across 7 tables, every one of which previously
-- compared against get_my_family_id()'s single, arbitrarily-chosen value.

ALTER POLICY "Delete books" ON books USING (family_id = ANY (get_my_family_ids()));
ALTER POLICY "Insert books" ON books WITH CHECK (family_id = ANY (get_my_family_ids()));
ALTER POLICY "View books" ON books USING (family_id = ANY (get_my_family_ids()));
ALTER POLICY "Update books" ON books USING (family_id = ANY (get_my_family_ids()));

ALTER POLICY "View own family" ON families USING (id = ANY (get_my_family_ids()));
ALTER POLICY "Update own family" ON families USING (id = ANY (get_my_family_ids()));

ALTER POLICY "Delete child profiles" ON family_members USING (family_id = ANY (get_my_family_ids()) AND is_child = true);
ALTER POLICY "Insert family members" ON family_members WITH CHECK (family_id = ANY (get_my_family_ids()) OR user_id = auth.uid());
ALTER POLICY "View family members" ON family_members USING (family_id = ANY (get_my_family_ids()));
ALTER POLICY "Update family members" ON family_members USING (family_id = ANY (get_my_family_ids()));

ALTER POLICY "Delete own family invites" ON invites USING (family_id = ANY (get_my_family_ids()));
ALTER POLICY "Create invites" ON invites WITH CHECK (family_id = ANY (get_my_family_ids()));
ALTER POLICY "View invites" ON invites USING (family_id = ANY (get_my_family_ids()) OR (accepted_at IS NULL AND expires_at > now()));
ALTER POLICY "Update invites" ON invites USING (family_id = ANY (get_my_family_ids()) OR accepted_at IS NULL);

ALTER POLICY "Insert ratings" ON ratings WITH CHECK (member_id IN (SELECT id FROM family_members WHERE family_id = ANY (get_my_family_ids())));
ALTER POLICY "View ratings" ON ratings USING (member_id IN (SELECT id FROM family_members WHERE family_id = ANY (get_my_family_ids())));
ALTER POLICY "Update ratings" ON ratings USING (member_id IN (SELECT id FROM family_members WHERE family_id = ANY (get_my_family_ids())));

ALTER POLICY "Insert reading progress" ON reading_progress WITH CHECK (member_id IN (SELECT id FROM family_members WHERE family_id = ANY (get_my_family_ids())));
ALTER POLICY "View reading progress" ON reading_progress USING (member_id IN (SELECT id FROM family_members WHERE family_id = ANY (get_my_family_ids())));
ALTER POLICY "Update reading progress" ON reading_progress USING (member_id IN (SELECT id FROM family_members WHERE family_id = ANY (get_my_family_ids())));

ALTER POLICY "Insert reading sessions" ON reading_sessions WITH CHECK (member_id IN (SELECT id FROM family_members WHERE family_id = ANY (get_my_family_ids())));
ALTER POLICY "View reading sessions" ON reading_sessions USING (member_id IN (SELECT id FROM family_members WHERE family_id = ANY (get_my_family_ids())));
ALTER POLICY "Update reading sessions" ON reading_sessions USING (member_id IN (SELECT id FROM family_members WHERE family_id = ANY (get_my_family_ids())));
