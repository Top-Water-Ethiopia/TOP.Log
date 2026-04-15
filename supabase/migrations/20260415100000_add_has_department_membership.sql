-- Security-definer helper to check if a user has ANY active membership in a department.
-- This bypasses RLS so server APIs can avoid false 403s when membership rows are not selectable.
CREATE OR REPLACE FUNCTION public.has_department_membership(p_user_id uuid, p_department_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_department_memberships
    WHERE user_id = p_user_id
      AND department_id = p_department_id
      AND is_active = TRUE
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_department_membership(uuid, uuid) TO authenticated;

