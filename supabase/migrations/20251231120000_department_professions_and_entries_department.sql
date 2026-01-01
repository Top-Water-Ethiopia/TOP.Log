BEGIN;

-- -----------------------------------------------------------------------------
-- 0) Compatibility: accept both legacy role spellings for department roles
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_view_department(p_department_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN public.has_department_role(
    p_department_id,
    ARRAY['department-lead','department-manager','supervisor','viewer','department_lead','department_manager']
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_view_department(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_view_user_entries(p_target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_user_id = p_target_user_id THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_department_roles viewer
    JOIN public.user_department_roles target
      ON target.department_id = viewer.department_id
     AND target.user_id = p_target_user_id
     AND target.is_active = TRUE
    WHERE viewer.user_id = v_user_id
      AND viewer.is_active = TRUE
      AND viewer.role IN ('department-lead','department-manager','supervisor','viewer','department_lead','department_manager')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_view_user_entries(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_view_user_profile(p_target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_user_id = p_target_user_id THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_department_roles viewer
    JOIN public.user_department_roles target
      ON target.department_id = viewer.department_id
     AND target.user_id = p_target_user_id
     AND target.is_active = TRUE
    WHERE viewer.user_id = v_user_id
      AND viewer.is_active = TRUE
      AND viewer.role IN ('department-lead','department-manager','supervisor','viewer','department_lead','department_manager')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_view_user_profile(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 1) Roles: allow same role name across departments (and between system vs dept)
-- -----------------------------------------------------------------------------

ALTER TABLE public.roles
  DROP CONSTRAINT IF EXISTS roles_name_key;

DROP INDEX IF EXISTS public.roles_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS roles_unique_system_name
  ON public.roles (name)
  WHERE department_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS roles_unique_department_name
  ON public.roles (department_id, name)
  WHERE department_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2) Profession role assignment per department
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_department_professions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL REFERENCES auth.users(id),
  updated_by UUID NULL REFERENCES auth.users(id),
  UNIQUE(user_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_user_department_professions_user
  ON public.user_department_professions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_department_professions_department
  ON public.user_department_professions(department_id);

CREATE INDEX IF NOT EXISTS idx_user_department_professions_role
  ON public.user_department_professions(role_id);

ALTER TABLE public.user_department_professions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own department professions" ON public.user_department_professions;
CREATE POLICY "Users can view their own department professions"
  ON public.user_department_professions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Department roles can view department professions" ON public.user_department_professions;
CREATE POLICY "Department roles can view department professions"
  ON public.user_department_professions FOR SELECT
  USING (public.can_view_department(department_id));

-- -----------------------------------------------------------------------------
-- 2.1) Department-aware entry visibility helper
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_view_entry(p_department_id UUID, p_target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_user_id = p_target_user_id THEN
    RETURN TRUE;
  END IF;

  IF p_department_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_department_roles viewer
    JOIN public.user_department_roles target
      ON target.department_id = viewer.department_id
     AND target.user_id = p_target_user_id
     AND target.is_active = TRUE
    WHERE viewer.user_id = v_user_id
      AND viewer.is_active = TRUE
      AND viewer.department_id = p_department_id
      AND viewer.role IN ('department-lead','department-manager','supervisor','viewer','department_lead','department_manager')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_view_entry(UUID, UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3) Entries belong to a department
-- -----------------------------------------------------------------------------

ALTER TABLE public.captain_log_entries
  ADD COLUMN IF NOT EXISTS department_id UUID NULL REFERENCES public.departments(id) ON DELETE SET NULL;

-- Backfill department_id from legacy user_profiles.department_id where possible
UPDATE public.captain_log_entries cle
SET department_id = up.department_id
FROM public.user_profiles up
WHERE cle.user_id = up.user_id
  AND cle.department_id IS NULL
  AND up.department_id IS NOT NULL;

-- If still NULL, try to infer from user's active department membership
UPDATE public.captain_log_entries cle
SET department_id = udr.department_id
FROM public.user_department_roles udr
WHERE cle.user_id = udr.user_id
  AND cle.department_id IS NULL
  AND udr.is_active = TRUE;

-- Replace UNIQUE(user_id, date) with UNIQUE(user_id, department_id, date)
ALTER TABLE public.captain_log_entries
  DROP CONSTRAINT IF EXISTS captain_log_entries_user_id_date_key;

DROP INDEX IF EXISTS public.captain_log_entries_user_id_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS captain_log_entries_user_department_date_key
  ON public.captain_log_entries(user_id, department_id, date);

-- Ensure department report visibility doesn't leak across departments.
DROP POLICY IF EXISTS "Department roles can view department entries" ON public.captain_log_entries;
CREATE POLICY "Department roles can view department entries"
  ON public.captain_log_entries FOR SELECT
  USING (public.can_view_entry(department_id, user_id));

DROP POLICY IF EXISTS "Department roles can view department responses" ON public.custom_responses;
CREATE POLICY "Department roles can view department responses"
  ON public.custom_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.captain_log_entries cle
      WHERE cle.id = public.custom_responses.entry_id
        AND public.can_view_entry(cle.department_id, cle.user_id)
    )
  );

COMMIT;
