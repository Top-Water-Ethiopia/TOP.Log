-- Add multi-department membership with department-scoped roles

-- ============================================================================
-- 1) Table: user_department_roles
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_department_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_user_department_roles_user ON user_department_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_department_roles_department ON user_department_roles(department_id);

ALTER TABLE user_department_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2) Helper functions (SECURITY DEFINER)
-- ============================================================================

CREATE OR REPLACE FUNCTION has_department_role(p_department_id UUID, p_roles TEXT[])
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

  RETURN EXISTS (
    SELECT 1
    FROM public.user_department_roles udr
    WHERE udr.user_id = v_user_id
      AND udr.department_id = p_department_id
      AND udr.is_active = TRUE
      AND udr.role = ANY(p_roles)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION has_department_role(UUID, TEXT[]) TO authenticated;

CREATE OR REPLACE FUNCTION can_view_department(p_department_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN has_department_role(
    p_department_id,
    ARRAY['department-lead','department-manager','supervisor','viewer']
  );
END;
$$;

GRANT EXECUTE ON FUNCTION can_view_department(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION can_view_user_entries(p_target_user_id UUID)
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
      AND viewer.role IN ('department-lead','department-manager','supervisor','viewer')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION can_view_user_entries(UUID) TO authenticated;

-- ============================================================================
-- 3) Policies: user_department_roles (member list)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own department roles" ON user_department_roles;
CREATE POLICY "Users can view their own department roles"
  ON user_department_roles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Department roles can view department members" ON user_department_roles;
CREATE POLICY "Department roles can view department members"
  ON user_department_roles FOR SELECT
  USING (can_view_department(department_id));

-- ============================================================================
-- 4) Policies: captain_log_entries + custom_responses (department reports)
-- ============================================================================

DROP POLICY IF EXISTS "Department roles can view department entries" ON captain_log_entries;
CREATE POLICY "Department roles can view department entries"
  ON captain_log_entries FOR SELECT
  USING (can_view_user_entries(user_id));

DROP POLICY IF EXISTS "Department roles can view department responses" ON custom_responses;
CREATE POLICY "Department roles can view department responses"
  ON custom_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM captain_log_entries cle
      WHERE cle.id = custom_responses.entry_id
        AND can_view_user_entries(cle.user_id)
    )
  );

-- ============================================================================
-- 5) Seed: create a default membership row from legacy user_profiles.department_id
-- ============================================================================

INSERT INTO user_department_roles (user_id, department_id, role, is_active)
SELECT up.user_id, up.department_id, 'contributor', TRUE
FROM public.user_profiles up
WHERE up.department_id IS NOT NULL
ON CONFLICT (user_id, department_id) DO NOTHING;
