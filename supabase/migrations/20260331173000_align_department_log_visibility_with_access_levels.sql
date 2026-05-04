BEGIN;

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

  IF v_user_id = p_target_user_id THEN
    RETURN TRUE;
  END IF;

  IF p_department_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_department_access_levels viewer
    JOIN public.department_access_levels access_level
      ON access_level.id = viewer.access_level_id
    WHERE viewer.user_id = v_user_id
      AND viewer.department_id = p_department_id
      AND replace(lower(access_level.name), '_', '-') = 'department-lead'
  );
END;
$function$;

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

  RETURN EXISTS (
    SELECT 1
    FROM public.user_department_access_levels viewer
    JOIN public.department_access_levels access_level
      ON access_level.id = viewer.access_level_id
    WHERE viewer.user_id = v_user_id
      AND replace(lower(access_level.name), '_', '-') = 'department-lead'
      AND (
        EXISTS (
          SELECT 1
          FROM public.user_department_access_levels target_access
          WHERE target_access.user_id = p_target_user_id
            AND target_access.department_id = viewer.department_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_department_professions target_profession
          WHERE target_profession.user_id = p_target_user_id
            AND target_profession.department_id = viewer.department_id
            AND target_profession.is_active = TRUE
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_profiles target_profile
          WHERE target_profile.user_id = p_target_user_id
            AND target_profile.department_id = viewer.department_id
        )
      )
  );
END;
$function$;

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

  RETURN EXISTS (
    SELECT 1
    FROM public.user_department_access_levels viewer
    JOIN public.department_access_levels access_level
      ON access_level.id = viewer.access_level_id
    WHERE viewer.user_id = v_user_id
      AND replace(lower(access_level.name), '_', '-') = 'department-lead'
      AND (
        EXISTS (
          SELECT 1
          FROM public.user_department_access_levels target_access
          WHERE target_access.user_id = p_target_user_id
            AND target_access.department_id = viewer.department_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_department_professions target_profession
          WHERE target_profession.user_id = p_target_user_id
            AND target_profession.department_id = viewer.department_id
            AND target_profession.is_active = TRUE
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_profiles target_profile
          WHERE target_profile.user_id = p_target_user_id
            AND target_profile.department_id = viewer.department_id
        )
      )
  );
END;
$function$;

COMMIT;
