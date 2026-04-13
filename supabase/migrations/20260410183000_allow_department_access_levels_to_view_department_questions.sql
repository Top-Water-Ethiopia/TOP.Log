BEGIN;

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

  IF EXISTS (
    SELECT 1
    FROM public.user_department_professions udp
    WHERE udp.user_id = v_user_id
      AND udp.department_id = p_department_id
      AND udp.is_active = TRUE
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_department_access_levels udal
    JOIN public.department_access_level_permissions dalp
      ON dalp.access_level_id = udal.access_level_id
    JOIN public.permission_definitions pd
      ON pd.id = dalp.permission_definition_id
    WHERE udal.user_id = v_user_id
      AND udal.department_id = p_department_id
      AND dalp.effect = 'allow'
      AND pd.resource = 'department_questions'
      AND pd.action IN ('read', 'answer')
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.can_view_department_questions(uuid) TO authenticated;

COMMIT;
