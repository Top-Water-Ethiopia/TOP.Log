-- Allow department roles to read member profiles (for member list)

-- NOTE: We intentionally do NOT grant broad access to all user_profiles.
-- Access is limited to members of departments the requester can view.

-- SECURITY DEFINER helper: can_view_user_profile

CREATE OR REPLACE FUNCTION can_view_user_profile(p_target_user_id UUID)
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

GRANT EXECUTE ON FUNCTION can_view_user_profile(UUID) TO authenticated;

-- Policy: department roles can read member profiles

DROP POLICY IF EXISTS "Department roles can view member profiles" ON user_profiles;
CREATE POLICY "Department roles can view member profiles"
  ON user_profiles FOR SELECT
  USING (can_view_user_profile(user_id));
