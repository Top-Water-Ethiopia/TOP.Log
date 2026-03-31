BEGIN;

CREATE OR REPLACE FUNCTION public.can_manage_sub_team_members(p_user_id uuid, p_sub_team_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_department_id uuid;
  v_is_admin boolean;
  v_is_lead boolean;
  v_is_dept_manager boolean;
  v_can_manage boolean;
BEGIN
  IF p_user_id IS NULL OR p_sub_team_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT public.is_admin_user(p_user_id) INTO v_is_admin;
  IF COALESCE(v_is_admin, false) THEN
    RETURN true;
  END IF;

  SELECT st.department_id
    INTO v_department_id
  FROM public.sub_teams st
  WHERE st.id = p_sub_team_id;

  IF v_department_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_department_professions udp
      WHERE udp.user_id = p_user_id
        AND udp.department_id = v_department_id
        AND udp.role IN ('department_lead', 'manager')
    ) INTO v_is_dept_manager;

    IF COALESCE(v_is_dept_manager, false) THEN
      RETURN true;
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.sub_team_members stm
    WHERE stm.sub_team_id = p_sub_team_id
      AND stm.user_id = p_user_id
      AND stm.role = 'lead'
  ) INTO v_is_lead;

  IF NOT COALESCE(v_is_lead, false) THEN
    RETURN false;
  END IF;

  SELECT public.user_has_permission(p_user_id, 'sub_teams.members.manage') INTO v_can_manage;
  RETURN COALESCE(v_can_manage, false);
END;
$function$;

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
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_department_professions udp
    WHERE udp.user_id = v_user_id
      AND udp.department_id = p_department_id
      AND udp.is_active = TRUE
  );
END;
$function$;

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
    FROM public.user_department_professions viewer
    JOIN public.user_department_professions target
      ON target.department_id = viewer.department_id
     AND target.user_id = p_target_user_id
     AND target.is_active = TRUE
    WHERE viewer.user_id = v_user_id
      AND viewer.is_active = TRUE
      AND viewer.department_id = p_department_id
      AND viewer.role IN ('department-lead','department-manager','supervisor','viewer','department_lead','department_manager')
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
    FROM public.user_department_professions viewer
    JOIN public.user_department_professions target
      ON target.department_id = viewer.department_id
     AND target.user_id = p_target_user_id
     AND target.is_active = TRUE
    WHERE viewer.user_id = v_user_id
      AND viewer.is_active = TRUE
      AND viewer.role IN ('department-lead','department-manager','supervisor','viewer','department_lead','department_manager')
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
    FROM public.user_department_professions viewer
    JOIN public.user_department_professions target
      ON target.department_id = viewer.department_id
     AND target.user_id = p_target_user_id
     AND target.is_active = TRUE
    WHERE viewer.user_id = v_user_id
      AND viewer.is_active = TRUE
      AND viewer.role IN ('department-lead','department-manager','supervisor','viewer','department_lead','department_manager')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.cascade_department_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.is_active = false AND OLD.is_active = true THEN
    UPDATE public.user_department_professions
    SET is_active = false, updated_at = NOW()
    WHERE department_id = NEW.id AND is_active = true;

    UPDATE public.user_department_access_levels
    SET updated_at = NOW()
    WHERE department_id = NEW.id;

    UPDATE public.role_questions
    SET is_active = false, updated_at = NOW()
    WHERE department_id = NEW.id AND is_active = true;

    UPDATE public.department_professions
    SET is_active = false, updated_at = NOW()
    WHERE department_id = NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_profession_matches_active_department()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.is_active IS TRUE THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.user_department_professions udp
      WHERE udp.user_id = NEW.user_id
        AND udp.department_id = NEW.department_id
        AND udp.is_active = TRUE
    ) THEN
      RAISE EXCEPTION 'Active profession must match an active department membership';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

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
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_department_professions udp
    WHERE udp.user_id = v_user_id
      AND udp.department_id = p_department_id
      AND udp.is_active = TRUE
      AND udp.role = ANY(p_roles)
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;
