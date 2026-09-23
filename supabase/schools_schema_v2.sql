-- ─────────────────────────────────────────────────────────────────────────────
-- Bookie — Schools schema v2: registration & super-admin approval
-- Run after schools_schema.sql
--
-- Schools now require super-admin approval before they can function
-- (grades/classes/staff invites are blocked while pending). No account is
-- required to apply — a public applicant supplies contact details only, and
-- a magic sign-in link (via admin_claim_code) completes their setup once
-- approved. An already-authenticated user's in-app "Create School" still
-- gets them an immediate school_members admin row, but the school itself
-- is still pending until a super admin approves it — same trust model
-- either way, since schools handle children's data regardless of who set
-- them up.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS applicant_name      text,
  ADD COLUMN IF NOT EXISTS applicant_role      text,
  ADD COLUMN IF NOT EXISTS applicant_email     text,
  ADD COLUMN IF NOT EXISTS applicant_phone     text,
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS popia_attested_at   timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at         timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by         uuid REFERENCES family_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason    text,
  ADD COLUMN IF NOT EXISTS admin_claim_code    text UNIQUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper functions
-- ─────────────────────────────────────────────────────────────────────────────

-- Schools an admin manages, restricted to approved ones — used to gate
-- grade/class/staff-invite creation so a pending school can't function yet.
CREATE OR REPLACE FUNCTION get_my_approved_admin_school_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(ARRAY_AGG(DISTINCT sm.school_id), ARRAY[]::uuid[])
  FROM school_members sm
  JOIN family_members fm ON fm.id = sm.family_member_id
  JOIN schools s ON s.id = sm.school_id
  WHERE fm.user_id = auth.uid() AND sm.role = 'admin' AND s.status = 'approved';
$$;

-- Preview a school-admin claim code before activating it (shown on /join/:code).
CREATE OR REPLACE FUNCTION get_school_claim_preview(p_code text)
RETURNS TABLE (school_name text, applicant_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.name, s.applicant_name FROM schools s
  WHERE s.admin_claim_code = p_code AND s.status = 'approved';
$$;

-- Activate a school-admin claim: creates the caller's family if they don't
-- have one yet (they may be a brand-new magic-link sign-in), then attaches
-- them as the school's admin. Mirrors claim_class_learner's shape.
CREATE OR REPLACE FUNCTION claim_school_admin(p_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_school        record;
  v_my_member_id  uuid;
  v_family_id     uuid;
begin
  select * into v_school from public.schools where admin_claim_code = p_code and status = 'approved';
  if not found then
    raise exception 'Invalid or already used claim code';
  end if;

  select id, family_id into v_my_member_id, v_family_id
  from public.family_members where user_id = auth.uid();

  if v_my_member_id is null then
    v_family_id := gen_random_uuid();
    insert into public.families (id, name, created_by)
    values (v_family_id, coalesce(v_school.applicant_name, 'My') || '''s Family', auth.uid());

    v_my_member_id := gen_random_uuid();
    insert into public.family_members (id, family_id, user_id, role, nickname, avatar_emoji, is_child, color)
    values (v_my_member_id, v_family_id, auth.uid(), 'Other', coalesce(v_school.applicant_name, 'Admin'), '🏫', false, '#3B6E52');
  end if;

  insert into public.school_members (school_id, family_member_id, role)
  values (v_school.id, v_my_member_id, 'admin')
  on conflict (school_id, family_member_id, class_id) do nothing;

  update public.schools set admin_claim_code = null, created_by = v_my_member_id where id = v_school.id;

  return v_school.id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "grades_insert" ON grades;
CREATE POLICY "grades_insert" ON grades FOR INSERT WITH CHECK (school_id = ANY(get_my_approved_admin_school_ids()));

DROP POLICY IF EXISTS "classes_insert" ON classes;
CREATE POLICY "classes_insert" ON classes FOR INSERT WITH CHECK (school_id = ANY(get_my_approved_admin_school_ids()));

DROP POLICY IF EXISTS "school_staff_invites_insert" ON school_staff_invites;
CREATE POLICY "school_staff_invites_insert" ON school_staff_invites FOR INSERT WITH CHECK (school_id = ANY(get_my_approved_admin_school_ids()));

-- schools: super admins can see and review every application; anyone
-- (including a signed-out visitor on the public application form) can
-- submit a pending application with contact details — approval and the
-- policies above gate everything that actually matters.
DROP POLICY IF EXISTS "schools_select" ON schools;
CREATE POLICY "schools_select" ON schools
  FOR SELECT USING (id = ANY(get_my_school_ids()) OR is_super_admin());

DROP POLICY IF EXISTS "schools_insert" ON schools;
CREATE POLICY "schools_insert" ON schools
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    OR (status = 'pending' AND applicant_email IS NOT NULL)
  );

DROP POLICY IF EXISTS "schools_update" ON schools;
CREATE POLICY "schools_update" ON schools
  FOR UPDATE USING (id = ANY(get_my_admin_school_ids()) OR is_super_admin());
