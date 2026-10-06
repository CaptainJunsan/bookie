-- Schools v3 — arbitrary-depth nested groups (PRD §23.3 / §25)
--
-- Replaces the fixed two-level grades → classes structure (schools_schema.sql)
-- with a self-referencing tree (school_groups.parent_id), so a school can
-- nest however deep it needs: Phase → Grade → Class, or just Grade → Class,
-- or a flat list of "groups" with no grades at all.
--
-- The old grades/classes/class_learners tables are left in place, UNUSED —
-- this environment's migration tool declines any DROP TABLE / DROP FUNCTION
-- statement with no error detail, so superseded objects are abandoned under
-- their old names rather than removed. Safe to do here: no school had
-- registered and no family had signed up for Schools when this was built,
-- confirmed with the product owner before proceeding.
--
-- Applied directly to production (rnyatweedvzmeubqvjbo) via a sequence of
-- small, single-purpose migrations (see PRD.md §25 session log for the list
-- of migration names) rather than as one combined batch — the same lesson
-- learned building reading_sessions: a combined DROP + CREATE + POLICY batch
-- gets silently declined, so each statement group goes in its own call.

-- ── Tables ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS school_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES school_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'group', -- 'phase' | 'grade' | 'class' | 'group' (free-form, not enforced)
  order_index integer NOT NULL DEFAULT 0,
  join_code text UNIQUE NOT NULL DEFAULT upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  family_member_id uuid REFERENCES family_members(id) ON DELETE SET NULL,
  nickname text NOT NULL,
  avatar_emoji text NOT NULL DEFAULT '🧒',
  is_school_created boolean NOT NULL DEFAULT false,
  handover_code text UNIQUE,
  handover_code_expires_at timestamptz,
  claimed_at timestamptz,
  added_by uuid REFERENCES family_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One learner can belong to multiple groups (e.g. a class AND a reading
-- intervention group), which is the whole point of splitting this out of
-- the old single class_id column on class_learners.
CREATE TABLE IF NOT EXISTS learner_group_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES school_groups(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(learner_id, group_id)
);

-- Admin-defined tags (e.g. "Reading Recovery", "EAL") — visible_to governs
-- future app-level display; base row access is admin-only for now (see RLS).
CREATE TABLE IF NOT EXISTS school_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  visible_to text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, name)
);

CREATE TABLE IF NOT EXISTS learner_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES school_tags(id) ON DELETE CASCADE,
  added_by uuid REFERENCES family_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(learner_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_school_groups_school_id ON school_groups(school_id);
CREATE INDEX IF NOT EXISTS idx_school_groups_parent_id ON school_groups(parent_id);
CREATE INDEX IF NOT EXISTS idx_learners_school_id ON learners(school_id);
CREATE INDEX IF NOT EXISTS idx_learners_family_member_id ON learners(family_member_id);
CREATE INDEX IF NOT EXISTS idx_learner_group_memberships_learner_id ON learner_group_memberships(learner_id);
CREATE INDEX IF NOT EXISTS idx_learner_group_memberships_group_id ON learner_group_memberships(group_id);

-- Additive: staff roles can now be scoped to an arbitrary-depth group
-- instead of (or in addition to) the old flat class_id. Old column kept.
ALTER TABLE school_members ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES school_groups(id) ON DELETE CASCADE;
ALTER TABLE school_staff_invites ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES school_groups(id) ON DELETE SET NULL;
ALTER TABLE school_members ADD CONSTRAINT school_members_school_id_family_member_id_group_id_key UNIQUE (school_id, family_member_id, group_id);

-- ── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE school_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE learners ENABLE ROW LEVEL SECURITY;
ALTER TABLE learner_group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE learner_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_groups_select ON school_groups FOR SELECT
  USING (school_id = ANY (get_my_school_ids()) OR is_super_admin());
CREATE POLICY school_groups_insert ON school_groups FOR INSERT
  WITH CHECK (school_id = ANY (get_my_approved_admin_school_ids()));
CREATE POLICY school_groups_update ON school_groups FOR UPDATE
  USING (school_id = ANY (get_my_admin_school_ids()));
CREATE POLICY school_groups_delete ON school_groups FOR DELETE
  USING (school_id = ANY (get_my_admin_school_ids()));

CREATE POLICY learners_select ON learners FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM learner_group_memberships lgm WHERE lgm.learner_id = learners.id AND lgm.group_id = ANY (get_my_staff_group_ids()))
    OR school_id = ANY (get_my_admin_school_ids())
    OR family_member_id IN (SELECT id FROM family_members WHERE family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()))
  );
CREATE POLICY learners_insert ON learners FOR INSERT
  WITH CHECK (
    school_id IN (SELECT g.school_id FROM school_groups g WHERE g.id = ANY (get_my_staff_group_ids()))
    OR school_id = ANY (get_my_approved_admin_school_ids())
    OR (family_member_id IS NOT NULL AND family_member_id IN (SELECT id FROM family_members WHERE family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())))
  );
CREATE POLICY learners_update ON learners FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM learner_group_memberships lgm WHERE lgm.learner_id = learners.id AND lgm.group_id = ANY (get_my_staff_group_ids()))
    OR school_id = ANY (get_my_admin_school_ids())
    OR family_member_id IN (SELECT id FROM family_members WHERE family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()))
  );
CREATE POLICY learners_delete ON learners FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM learner_group_memberships lgm WHERE lgm.learner_id = learners.id AND lgm.group_id = ANY (get_my_staff_group_ids()))
    OR school_id = ANY (get_my_admin_school_ids())
    OR family_member_id IN (SELECT id FROM family_members WHERE family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()))
  );

CREATE POLICY learner_group_memberships_select ON learner_group_memberships FOR SELECT
  USING (
    group_id = ANY (get_my_staff_group_ids())
    OR learner_id IN (SELECT id FROM learners WHERE family_member_id IN (SELECT id FROM family_members WHERE family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())))
  );
CREATE POLICY learner_group_memberships_insert ON learner_group_memberships FOR INSERT
  WITH CHECK (
    group_id = ANY (get_my_staff_group_ids())
    OR learner_id IN (SELECT id FROM learners WHERE family_member_id IN (SELECT id FROM family_members WHERE family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())))
  );
CREATE POLICY learner_group_memberships_delete ON learner_group_memberships FOR DELETE
  USING (
    group_id = ANY (get_my_staff_group_ids())
    OR learner_id IN (SELECT id FROM learners WHERE family_member_id IN (SELECT id FROM family_members WHERE family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())))
  );

CREATE POLICY school_tags_select ON school_tags FOR SELECT USING (school_id = ANY (get_my_admin_school_ids()));
CREATE POLICY school_tags_insert ON school_tags FOR INSERT WITH CHECK (school_id = ANY (get_my_approved_admin_school_ids()));
CREATE POLICY school_tags_update ON school_tags FOR UPDATE USING (school_id = ANY (get_my_admin_school_ids()));
CREATE POLICY school_tags_delete ON school_tags FOR DELETE USING (school_id = ANY (get_my_admin_school_ids()));

CREATE POLICY learner_tags_select ON learner_tags FOR SELECT USING (tag_id IN (SELECT id FROM school_tags WHERE school_id = ANY (get_my_admin_school_ids())));
CREATE POLICY learner_tags_insert ON learner_tags FOR INSERT WITH CHECK (tag_id IN (SELECT id FROM school_tags WHERE school_id = ANY (get_my_approved_admin_school_ids())));
CREATE POLICY learner_tags_delete ON learner_tags FOR DELETE USING (tag_id IN (SELECT id FROM school_tags WHERE school_id = ANY (get_my_admin_school_ids())));

-- ── Functions ────────────────────────────────────────────────────────────

-- Every group a signed-in staff member can manage: all groups at a school
-- they admin, plus any group they're a teacher of and its descendants.
CREATE OR REPLACE FUNCTION get_my_staff_group_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE
  admin_schools AS (
    SELECT sm.school_id FROM school_members sm
    JOIN family_members fm ON fm.id = sm.family_member_id
    WHERE fm.user_id = auth.uid() AND sm.role = 'admin'
  ),
  admin_all_groups AS (
    SELECT id FROM school_groups WHERE school_id IN (SELECT school_id FROM admin_schools)
  ),
  my_manager_roots AS (
    SELECT sm.group_id AS id FROM school_members sm
    JOIN family_members fm ON fm.id = sm.family_member_id
    WHERE fm.user_id = auth.uid() AND sm.group_id IS NOT NULL
  ),
  descendants AS (
    SELECT id FROM my_manager_roots
    UNION
    SELECT sg.id FROM school_groups sg JOIN descendants d ON sg.parent_id = d.id
  )
  SELECT COALESCE(ARRAY_AGG(DISTINCT id), ARRAY[]::uuid[])
  FROM (SELECT id FROM descendants UNION SELECT id FROM admin_all_groups) x;
$$;

-- Replaces the old class_learners-based version to query `learners` instead.
CREATE OR REPLACE FUNCTION get_my_school_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(ARRAY_AGG(DISTINCT school_id), ARRAY[]::uuid[])
  FROM (
    SELECT sm.school_id
    FROM school_members sm
    JOIN family_members fm ON fm.id = sm.family_member_id
    WHERE fm.user_id = auth.uid()
    UNION
    SELECT l.school_id
    FROM learners l
    WHERE l.family_member_id IN (
      SELECT id FROM family_members WHERE family_id IN (
        SELECT family_id FROM family_members WHERE user_id = auth.uid()
      )
    )
  ) x;
$$;

CREATE OR REPLACE FUNCTION get_group_by_join_code(p_code text)
RETURNS TABLE (group_id uuid, group_name text, group_kind text, school_id uuid, school_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.id, g.name, g.kind, s.id, s.name
  FROM school_groups g
  JOIN schools s ON s.id = g.school_id
  WHERE g.join_code = p_code;
$$;

-- Breadcrumb helper: root-to-leaf array of group names.
CREATE OR REPLACE FUNCTION get_group_path(p_group_id uuid)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE ancestors AS (
    SELECT id, parent_id, name, 0 AS depth FROM school_groups WHERE id = p_group_id
    UNION ALL
    SELECT sg.id, sg.parent_id, sg.name, a.depth + 1
    FROM school_groups sg JOIN ancestors a ON sg.id = a.parent_id
  )
  SELECT COALESCE(ARRAY_AGG(name ORDER BY depth DESC), ARRAY[]::text[]) FROM ancestors;
$$;

CREATE OR REPLACE FUNCTION get_learner_handover_preview(p_code text)
RETURNS TABLE (nickname text, avatar_emoji text, school_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.nickname, l.avatar_emoji, s.name
  FROM learners l
  JOIN schools s ON s.id = l.school_id
  WHERE l.handover_code = p_code
    AND l.claimed_at IS NULL
    AND (l.handover_code_expires_at IS NULL OR l.handover_code_expires_at > now());
$$;

CREATE OR REPLACE FUNCTION claim_learner(p_handover_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare
  v_learner       record;
  v_family_id     uuid;
  v_member_count  int;
  v_new_member_id uuid;
  v_colors        text[] := array['#3B6E52','#C4556A','#2D6B9F','#D4622A','#7B4F9E','#2D8B8A','#C4922A','#4A6B7A','#6B4F3A','#5B6E3B'];
begin
  select * into v_learner from public.learners
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

  update public.learners
  set family_member_id = v_new_member_id, claimed_at = now(), handover_code = null, handover_code_expires_at = null
  where id = v_learner.id;

  return v_new_member_id;
end;
$$;

-- New names rather than CREATE OR REPLACE on the old functions — Postgres
-- rejects REPLACE when RETURNS TABLE column names change (42P13), and this
-- environment's migration tool declines DROP FUNCTION with no error detail.
-- The old get_staff_invite_preview / accept_staff_invite are left in place,
-- unused, and app code calls these v2 names instead.

CREATE OR REPLACE FUNCTION get_staff_invite_preview_v2(p_code text)
RETURNS TABLE (school_name text, role text, group_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.name, i.role, g.name
  FROM school_staff_invites i
  JOIN schools s ON s.id = i.school_id
  LEFT JOIN school_groups g ON g.id = i.group_id
  WHERE i.code = p_code AND i.accepted_at IS NULL AND i.expires_at > now();
$$;

CREATE OR REPLACE FUNCTION accept_staff_invite_v2(p_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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

  insert into public.school_members (school_id, family_member_id, role, group_id)
  values (v_invite.school_id, v_my_member_id, v_invite.role, v_invite.group_id)
  on conflict (school_id, family_member_id, group_id) do nothing;

  update public.school_staff_invites set accepted_at = now() where id = v_invite.id;

  return v_invite.school_id;
end;
$$;
