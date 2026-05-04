BEGIN;

-- -----------------------------------------------------------------------------
-- 1) has_department_role: Unified version
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_department_role(p_department_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL OR p_department_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_department_memberships udm
    JOIN public.roles r ON r.id = udm.role_id
    WHERE udm.user_id = v_user_id
      AND udm.department_id = p_department_id
      AND udm.is_active = TRUE
      AND (r.name = ANY(p_roles) OR r.display_name = ANY(p_roles))
  );
END;
$function$;

-- -----------------------------------------------------------------------------
-- 2) can_view_department: Unified version
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_department(p_department_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.has_department_role(
    p_department_id,
    ARRAY['department-lead','department-manager','supervisor','viewer','department_lead','department_manager']
  );
END;
$function$;

-- -----------------------------------------------------------------------------
-- 3) can_view_department_questions: Unified version
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_department_questions(p_department_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL OR p_department_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Anyone with ANY active membership in the department can typically view questions
  -- Or explicitly check for the permission
  RETURN EXISTS (
    SELECT 1
    FROM public.user_department_memberships udm
    JOIN public.role_permissions rp ON rp.role_id = udm.role_id
    WHERE udm.user_id = v_user_id
      AND udm.department_id = p_department_id
      AND udm.is_active = TRUE
      AND rp.resource = 'department_questions'
      AND rp.action IN ('read', 'answer')
      AND rp.effect = 'allow'
  );
END;
$function$;

-- -----------------------------------------------------------------------------
-- 4) can_view_entry: Unified version
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_entry(p_department_id uuid, p_target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Users can always view their own entries
  IF v_user_id = p_target_user_id THEN
    RETURN TRUE;
  END IF;

  IF p_department_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if viewer has viewing rights in the target department
  RETURN EXISTS (
    SELECT 1
    FROM public.user_department_memberships viewer_udm
    JOIN public.roles r ON r.id = viewer_udm.role_id
    WHERE viewer_udm.user_id = v_user_id
      AND viewer_udm.department_id = p_department_id
      AND viewer_udm.is_active = TRUE
      AND r.name IN ('department-lead','department-manager','supervisor','viewer','department_lead','department_manager')
  );
END;
$function$;

-- -----------------------------------------------------------------------------
-- 5) can_view_user_entries: Unified version
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_user_entries(p_target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_user_id = p_target_user_id THEN
    RETURN TRUE;
  END IF;

  -- Check if they share any department where the viewer has viewing rights
  RETURN EXISTS (
    SELECT 1
    FROM public.user_department_memberships viewer
    JOIN public.user_department_memberships target
      ON target.department_id = viewer.department_id
    JOIN public.roles r ON r.id = viewer.role_id
    WHERE viewer.user_id = v_user_id
      AND viewer.is_active = TRUE
      AND target.user_id = p_target_user_id
      AND target.is_active = TRUE
      AND r.name IN ('department-lead','department-manager','supervisor','viewer','department_lead','department_manager')
  );
END;
$function$;

-- -----------------------------------------------------------------------------
-- 6) can_view_user_profile: Unified version
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_user_profile(p_target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_user_id = p_target_user_id THEN
    RETURN TRUE;
  END IF;

  -- Same logic as can_view_user_entries
  RETURN EXISTS (
    SELECT 1
    FROM public.user_department_memberships viewer
    JOIN public.user_department_memberships target
      ON target.department_id = viewer.department_id
    JOIN public.roles r ON r.id = viewer.role_id
    WHERE viewer.user_id = v_user_id
      AND viewer.is_active = TRUE
      AND target.user_id = p_target_user_id
      AND target.is_active = TRUE
      AND r.name IN ('department-lead','department-manager','supervisor','viewer','department_lead','department_manager')
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.has_department_role(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_department(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_department_questions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_entry(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_user_entries(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_user_profile(uuid) TO authenticated;

COMMIT;
