-- Enforce submitter entry kind availability server-side (cannot be bypassed by client inserts).
-- Blocks inserts into captain_log_entries when the requested entry_kind is not active+available
-- for the effective scope.
--
-- Error prefix for machine parsing:
--   APP_ERROR:ENTRY_KIND_UNAVAILABLE:

BEGIN;

CREATE OR REPLACE FUNCTION public.validate_entry_kind_available()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_department_id UUID;
  v_profession_role_id UUID;
  v_entry_kind TEXT;
  v_report_kind TEXT;
  v_has_any_target_rows BOOLEAN;
  v_has_prof_override BOOLEAN;
  v_allowed BOOLEAN;
BEGIN
  v_department_id := COALESCE(NEW.subject_department_id, NEW.department_id);
  v_profession_role_id := NEW.subject_profession_id;
  v_entry_kind := COALESCE(NULLIF(NEW.entry_kind, ''), 'standard');
  v_report_kind := COALESCE(NULLIF(NEW.report_kind, ''), 'personal');

  -- If we cannot determine the department, do not block here (other constraints/paths may apply).
  IF v_department_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Department/mixed reports must follow dept_report availability strictly.
  IF v_report_kind IN ('department', 'mixed') THEN
    SELECT EXISTS(
      SELECT 1
      FROM public.scope_entry_kinds sek
      WHERE sek.department_id = v_department_id
        AND sek.scope_type = 'dept_report'
        AND sek.department_profession_id IS NULL
        AND sek.entry_kind = v_entry_kind
        AND sek.is_active = TRUE
        AND sek.is_available = TRUE
    ) INTO v_allowed;

    IF v_allowed THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'APP_ERROR:ENTRY_KIND_UNAVAILABLE:Entry kind "%" is not available for department reporting.', v_entry_kind;
  END IF;

  -- Personal reports: prefer profession override only when there are active+available configs for that profession.
  IF v_profession_role_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1
      FROM public.scope_entry_kinds sek
      WHERE sek.department_id = v_department_id
        AND sek.scope_type = 'profession_personal'
        AND sek.profession_role_id = v_profession_role_id
        AND sek.is_active = TRUE
        AND sek.is_available = TRUE
    ) INTO v_has_prof_override;
  ELSE
    v_has_prof_override := FALSE;
  END IF;

  IF v_has_prof_override THEN
    SELECT EXISTS(
      SELECT 1
      FROM public.scope_entry_kinds sek
      WHERE sek.department_id = v_department_id
        AND sek.scope_type = 'profession_personal'
        AND sek.profession_role_id = v_profession_role_id
        AND sek.entry_kind = v_entry_kind
        AND sek.is_active = TRUE
        AND sek.is_available = TRUE
    ) INTO v_allowed;

    IF v_allowed THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'APP_ERROR:ENTRY_KIND_UNAVAILABLE:Entry kind "%" is not available for your profession in this department.', v_entry_kind;
  END IF;

  -- Dept-wide personal fallback.
  SELECT EXISTS(
    SELECT 1
    FROM public.scope_entry_kinds sek
    WHERE sek.department_id = v_department_id
      AND sek.scope_type = 'dept_wide_personal'
      AND sek.department_profession_id IS NULL
  ) INTO v_has_any_target_rows;

  -- Backward compatibility: if no dept-wide config rows exist at all, allow inserts (legacy behavior).
  IF NOT v_has_any_target_rows THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.scope_entry_kinds sek
    WHERE sek.department_id = v_department_id
      AND sek.scope_type = 'dept_wide_personal'
      AND sek.department_profession_id IS NULL
      AND sek.entry_kind = v_entry_kind
      AND sek.is_active = TRUE
      AND sek.is_available = TRUE
  ) INTO v_allowed;

  IF v_allowed THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'APP_ERROR:ENTRY_KIND_UNAVAILABLE:Entry kind "%" is not available for personal logging in this department.', v_entry_kind;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_entry_kind_available ON public.captain_log_entries;
CREATE TRIGGER trg_validate_entry_kind_available
BEFORE INSERT ON public.captain_log_entries
FOR EACH ROW
EXECUTE FUNCTION public.validate_entry_kind_available();

COMMIT;

