-- ─────────────────────────────────────────────────────────────────────────────
-- Bookie — Schools feature schema (PRD v0.3 §10)
-- Run this AFTER schema.sql and the clubs_schema*.sql files.
--
-- A school is its own top-level entity (not a club sub-type) — see PRD §10.2.
-- It has grades, which have classes, which have learners. A learner is either
-- an existing family child linked by a parent, or a profile the school itself
-- creates directly (no family account needed yet), which must later be handed
-- over to a parent/guardian — see PRD §10.3.
--
-- Deliberately NOT included yet (a later phase, per PRD §10.4/§10.5):
-- class-scoped books/reading progress ("class reading mode"), reports.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── schools ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schools (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  emoji       text NOT NULL DEFAULT '🏫',
  city        text,
  suburb      text,
  created_by  uuid REFERENCES family_members(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── school_members ───────────────────────────────────────────────────────────
-- Staff only (admin/teacher) — NOT learners. role: 'admin' | 'teacher'.
-- class_id is set when a teacher is scoped to one class; a teacher of two
-- classes gets two rows. NULL for admins (school-wide) and is allowed for a
-- teacher not yet assigned to a class.
CREATE TABLE IF NOT EXISTS school_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  family_member_id uuid NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  role             text NOT NULL DEFAULT 'teacher',
  class_id         uuid, -- FK added below, after `classes` exists
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, family_member_id, class_id)
);

-- ── grades ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grades (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name        text NOT NULL, -- e.g. "Grade 4"
  order_index integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── classes ──────────────────────────────────────────────────────────────────
-- join_code: short, spoken-aloud-friendly code for the class-join flow
-- (PRD §10.4). Distinct from a club's long invite_token by design.
CREATE TABLE IF NOT EXISTS classes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id   uuid NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  school_id  uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE, -- denormalized, simplifies RLS
  name       text NOT NULL, -- e.g. "4A"
  join_code  text UNIQUE NOT NULL DEFAULT upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE school_members
  ADD CONSTRAINT school_members_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

-- ── class_learners ───────────────────────────────────────────────────────────
-- The enrolment record — the single source of truth for "who is in this class."
-- Route 1 (parent links an existing child): family_member_id is set immediately,
--   is_school_created = false.
-- Route 2 (school creates the profile directly): family_member_id starts null,
--   is_school_created = true, a handover_code is generated. Claiming (via the
--   claim_class_learner() RPC below) creates the family_members row and sets
--   family_member_id + claimed_at, matching PRD §10.3.
-- nickname/avatar_emoji are always denormalized here (copied at enrolment time)
-- so roster display never needs cross-family access to family_members.
CREATE TABLE IF NOT EXISTS class_learners (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id                 uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  school_id                uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE, -- denormalized
  family_member_id         uuid REFERENCES family_members(id) ON DELETE SET NULL,
  nickname                 text NOT NULL,
  avatar_emoji             text NOT NULL DEFAULT '🧒',
  is_school_created        boolean NOT NULL DEFAULT false,
  handover_code            text UNIQUE,
  handover_code_expires_at timestamptz,
  claimed_at               timestamptz,
  added_by                 uuid REFERENCES family_members(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, family_member_id)
);

-- ── school_staff_invites ─────────────────────────────────────────────────────
-- How an admin brings in a teacher (or another admin) who isn't already
-- reachable — they aren't necessarily in the admin's own family, so this can't
-- reuse the family/club invite tables. A short code, resolved via the same
-- /join/:code entry point as class-join codes and handover codes.
CREATE TABLE IF NOT EXISTS school_staff_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'teacher', -- 'admin' | 'teacher'
  class_id    uuid REFERENCES classes(id) ON DELETE SET NULL, -- set for a teacher invite scoped to one class
  code        text UNIQUE NOT NULL DEFAULT upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8)),
  invited_by  uuid REFERENCES family_members(id) ON DELETE SET NULL,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper functions
-- ─────────────────────────────────────────────────────────────────────────────

-- Schools the current user can see: staff (admin/teacher) of the school, or a
-- family with any child (self or sibling) enrolled as a learner in it.
CREATE OR REPLACE FUNCTION get_my_school_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(ARRAY_AGG(DISTINCT school_id), ARRAY[]::uuid[])
  FROM (
    SELECT sm.school_id
    FROM school_members sm
    JOIN family_members fm ON fm.id = sm.family_member_id
    WHERE fm.user_id = auth.uid()
    UNION
    SELECT cl.school_id
    FROM class_learners cl
    WHERE cl.family_member_id IN (
      SELECT id FROM family_members WHERE family_id IN (
        SELECT family_id FROM family_members WHERE user_id = auth.uid()
      )
    )
  ) x;
$$;

-- Classes the current user has STAFF access to: a class they teach, or any
-- class in a school where they are an admin.
CREATE OR REPLACE FUNCTION get_my_staff_class_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(ARRAY_AGG(DISTINCT class_id), ARRAY[]::uuid[])
  FROM (
    SELECT sm.class_id
    FROM school_members sm
    JOIN family_members fm ON fm.id = sm.family_member_id
    WHERE fm.user_id = auth.uid() AND sm.class_id IS NOT NULL
    UNION
    SELECT c.id
    FROM classes c
    JOIN school_members sm ON sm.school_id = c.school_id
    JOIN family_members fm ON fm.id = sm.family_member_id
    WHERE fm.user_id = auth.uid() AND sm.role = 'admin'
  ) x;
$$;

-- Schools the current user administers (used to gate grade/class management).
CREATE OR REPLACE FUNCTION get_my_admin_school_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(ARRAY_AGG(DISTINCT sm.school_id), ARRAY[]::uuid[])
  FROM school_members sm
  JOIN family_members fm ON fm.id = sm.family_member_id
  WHERE fm.user_id = auth.uid() AND sm.role = 'admin';
$$;

-- Resolve a class by its short join code, without exposing full class listing
-- via RLS (mirrors the invite-token trust model already used for clubs/family
-- invites: knowing the code is the authorization to see this one row).
CREATE OR REPLACE FUNCTION get_class_by_join_code(p_code text)
RETURNS TABLE (class_id uuid, class_name text, grade_name text, school_id uuid, school_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, g.name, s.id, s.name
  FROM classes c
  JOIN grades g ON g.id = c.grade_id
  JOIN schools s ON s.id = c.school_id
  WHERE c.join_code = p_code;
$$;

-- Preview a handover code before claiming it (so the app can show "Claim
-- <nickname>'s profile from <school>?" before the parent commits).
CREATE OR REPLACE FUNCTION get_handover_preview(p_code text)
RETURNS TABLE (nickname text, avatar_emoji text, school_name text, class_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cl.nickname, cl.avatar_emoji, s.name, c.name
  FROM class_learners cl
  JOIN classes c ON c.id = cl.class_id
  JOIN schools s ON s.id = c.school_id
  WHERE cl.handover_code = p_code
    AND cl.claimed_at IS NULL
    AND (cl.handover_code_expires_at IS NULL OR cl.handover_code_expires_at > now());
$$;

-- Claim a school-created learner profile into the caller's own family
-- (PRD §10.3 handover). Creates a new, ordinary parent-managed child profile —
-- same shape as any other child in the app — and links it. Mirrors
-- claim_child_member()'s shape (SECURITY DEFINER, token/code-gated, single
-- responsibility) but this one also creates the family_members row, since
-- unlike claim_child_member there is no pre-existing row to attach to.
CREATE OR REPLACE FUNCTION claim_class_learner(p_handover_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_learner       record;
  v_family_id     uuid;
  v_member_count  int;
  v_new_member_id uuid;
  v_colors        text[] := array['#3B6E52','#C4556A','#2D6B9F','#D4622A','#7B4F9E','#2D8B8A','#C4922A','#4A6B7A','#6B4F3A','#5B6E3B'];
begin
  select * into v_learner from public.class_learners
  where handover_code = p_handover_code
    and claimed_at is null
    and (handover_code_expires_at is null or handover_code_expires_at > now());
  if not found then
    raise exception 'Invalid or expired handover code';
  end if;

  select family_id into v_family_id from public.family_members where user_id = auth.uid();
  if v_family_id is null then
    raise exception 'You need a Bookie family account before claiming a profile';
  end if;

  select count(*) into v_member_count from public.family_members where family_id = v_family_id;

  v_new_member_id := gen_random_uuid();
  insert into public.family_members (id, family_id, user_id, role, nickname, avatar_emoji, is_child, color)
  values (
    v_new_member_id, v_family_id, null, 'Other', v_learner.nickname, v_learner.avatar_emoji, true,
    v_colors[1 + (v_member_count % array_length(v_colors, 1))]
  );

  update public.class_learners
  set family_member_id = v_new_member_id, claimed_at = now(), handover_code = null, handover_code_expires_at = null
  where id = v_learner.id;

  return v_new_member_id;
end;
$$;

-- Preview a staff invite before accepting it.
CREATE OR REPLACE FUNCTION get_staff_invite_preview(p_code text)
RETURNS TABLE (school_name text, role text, class_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.name, i.role, c.name
  FROM school_staff_invites i
  JOIN schools s ON s.id = i.school_id
  LEFT JOIN classes c ON c.id = i.class_id
  WHERE i.code = p_code AND i.accepted_at IS NULL AND i.expires_at > now();
$$;

-- Accept a staff invite: adds the caller as a school_members row with the
-- invited role (and class, if scoped). Returns the school_id so the app can
-- redirect there.
CREATE OR REPLACE FUNCTION accept_staff_invite(p_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_invite       record;
  v_my_member_id uuid;
begin
  select * into v_invite from public.school_staff_invites
  where code = p_code and accepted_at is null and expires_at > now();
  if not found then
    raise exception 'Invalid or expired invite';
  end if;

  select id into v_my_member_id from public.family_members where user_id = auth.uid();
  if v_my_member_id is null then
    raise exception 'You need a Bookie account before accepting this invite';
  end if;

  insert into public.school_members (school_id, family_member_id, role, class_id)
  values (v_invite.school_id, v_my_member_id, v_invite.role, v_invite.class_id)
  on conflict (school_id, family_member_id, class_id) do nothing;

  update public.school_staff_invites set accepted_at = now() where id = v_invite.id;

  return v_invite.school_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE schools              ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades               ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_learners       ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_staff_invites ENABLE ROW LEVEL SECURITY;

-- ── schools ──────────────────────────────────────────────────────────────────
-- No public directory (unlike clubs) — visible only via get_my_school_ids().
DROP POLICY IF EXISTS "schools_select" ON schools;
CREATE POLICY "schools_select" ON schools
  FOR SELECT USING (id = ANY(get_my_school_ids()));

DROP POLICY IF EXISTS "schools_insert" ON schools;
CREATE POLICY "schools_insert" ON schools
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "schools_update" ON schools;
CREATE POLICY "schools_update" ON schools
  FOR UPDATE USING (id = ANY(get_my_admin_school_ids()));

DROP POLICY IF EXISTS "schools_delete" ON schools;
CREATE POLICY "schools_delete" ON schools
  FOR DELETE USING (id = ANY(get_my_admin_school_ids()));

-- ── school_members ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "school_members_select" ON school_members;
CREATE POLICY "school_members_select" ON school_members
  FOR SELECT USING (school_id = ANY(get_my_school_ids()));

-- The school's creator can always add staff (covers bootstrapping the first
-- admin row, since no school_members rows exist yet at that point); any
-- existing admin can add more staff after that.
DROP POLICY IF EXISTS "school_members_insert" ON school_members;
CREATE POLICY "school_members_insert" ON school_members
  FOR INSERT WITH CHECK (
    school_id IN (SELECT id FROM schools WHERE created_by IN (SELECT id FROM family_members WHERE user_id = auth.uid()))
    OR school_id = ANY(get_my_admin_school_ids())
  );

DROP POLICY IF EXISTS "school_members_update" ON school_members;
CREATE POLICY "school_members_update" ON school_members
  FOR UPDATE USING (school_id = ANY(get_my_admin_school_ids()));

-- Staff can remove themselves; admins can remove anyone.
DROP POLICY IF EXISTS "school_members_delete" ON school_members;
CREATE POLICY "school_members_delete" ON school_members
  FOR DELETE USING (
    family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid())
    OR school_id = ANY(get_my_admin_school_ids())
  );

-- ── grades ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "grades_select" ON grades;
CREATE POLICY "grades_select" ON grades
  FOR SELECT USING (school_id = ANY(get_my_school_ids()));

DROP POLICY IF EXISTS "grades_insert" ON grades;
CREATE POLICY "grades_insert" ON grades
  FOR INSERT WITH CHECK (school_id = ANY(get_my_admin_school_ids()));

DROP POLICY IF EXISTS "grades_update" ON grades;
CREATE POLICY "grades_update" ON grades
  FOR UPDATE USING (school_id = ANY(get_my_admin_school_ids()));

DROP POLICY IF EXISTS "grades_delete" ON grades;
CREATE POLICY "grades_delete" ON grades
  FOR DELETE USING (school_id = ANY(get_my_admin_school_ids()));

-- ── classes ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "classes_select" ON classes;
CREATE POLICY "classes_select" ON classes
  FOR SELECT USING (school_id = ANY(get_my_school_ids()));

DROP POLICY IF EXISTS "classes_insert" ON classes;
CREATE POLICY "classes_insert" ON classes
  FOR INSERT WITH CHECK (school_id = ANY(get_my_admin_school_ids()));

DROP POLICY IF EXISTS "classes_update" ON classes;
CREATE POLICY "classes_update" ON classes
  FOR UPDATE USING (school_id = ANY(get_my_admin_school_ids()));

DROP POLICY IF EXISTS "classes_delete" ON classes;
CREATE POLICY "classes_delete" ON classes
  FOR DELETE USING (school_id = ANY(get_my_admin_school_ids()));

-- ── class_learners ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "class_learners_select" ON class_learners;
CREATE POLICY "class_learners_select" ON class_learners
  FOR SELECT USING (
    class_id = ANY(get_my_staff_class_ids())
    OR family_member_id IN (
      SELECT id FROM family_members WHERE family_id IN (
        SELECT family_id FROM family_members WHERE user_id = auth.uid()
      )
    )
  );

-- Two ways to insert: a teacher/admin adding a learner to their class
-- (school-created route, or manually rostering), or a parent linking one of
-- their own existing children (family_member_id must belong to their family).
-- class_id itself is only ever discovered via get_class_by_join_code() or
-- existing staff access, so this doesn't need to re-gate class visibility.
DROP POLICY IF EXISTS "class_learners_insert" ON class_learners;
CREATE POLICY "class_learners_insert" ON class_learners
  FOR INSERT WITH CHECK (
    class_id = ANY(get_my_staff_class_ids())
    OR (
      family_member_id IS NOT NULL
      AND family_member_id IN (
        SELECT id FROM family_members WHERE family_id IN (
          SELECT family_id FROM family_members WHERE user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "class_learners_update" ON class_learners;
CREATE POLICY "class_learners_update" ON class_learners
  FOR UPDATE USING (
    class_id = ANY(get_my_staff_class_ids())
    OR family_member_id IN (
      SELECT id FROM family_members WHERE family_id IN (
        SELECT family_id FROM family_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "class_learners_delete" ON class_learners;
CREATE POLICY "class_learners_delete" ON class_learners
  FOR DELETE USING (
    class_id = ANY(get_my_staff_class_ids())
    OR family_member_id IN (
      SELECT id FROM family_members WHERE family_id IN (
        SELECT family_id FROM family_members WHERE user_id = auth.uid()
      )
    )
  );

-- ── school_staff_invites ─────────────────────────────────────────────────────
-- Admin-only in every direction; resolution for acceptance goes through the
-- SECURITY DEFINER RPCs above, not a direct SELECT (same trust model as the
-- class join code / handover code).
DROP POLICY IF EXISTS "school_staff_invites_select" ON school_staff_invites;
CREATE POLICY "school_staff_invites_select" ON school_staff_invites
  FOR SELECT USING (school_id = ANY(get_my_admin_school_ids()));

DROP POLICY IF EXISTS "school_staff_invites_insert" ON school_staff_invites;
CREATE POLICY "school_staff_invites_insert" ON school_staff_invites
  FOR INSERT WITH CHECK (school_id = ANY(get_my_admin_school_ids()));

DROP POLICY IF EXISTS "school_staff_invites_delete" ON school_staff_invites;
CREATE POLICY "school_staff_invites_delete" ON school_staff_invites
  FOR DELETE USING (school_id = ANY(get_my_admin_school_ids()));

-- ── Cross-family visibility for staff ────────────────────────────────────────
-- Staff aren't necessarily related by family, so without this, a school's
-- other staff show up as blank/null when joined against family_members —
-- same issue clubs solved in clubs_schema_patch.sql. Learners don't need this:
-- class_learners already carries its own denormalized nickname/avatar.
DROP POLICY IF EXISTS "View fellow school staff" ON family_members;
CREATE POLICY "View fellow school staff" ON family_members
  FOR SELECT USING (
    id IN (
      SELECT family_member_id FROM school_members
      WHERE school_id = ANY(get_my_school_ids())
    )
  );
