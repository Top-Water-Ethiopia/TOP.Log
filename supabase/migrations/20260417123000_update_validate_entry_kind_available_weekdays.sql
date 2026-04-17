-- Update validate_entry_kind_available trigger to enforce allowed_weekdays based on NEW.date.
-- Uses canonical SQL function public.is_entry_kind_available(...).
--
-- Typed error contract:
--   MESSAGE: APP_ERROR:ENTRY_KIND_UNAVAILABLE
--   DETAIL: JSON with scope/kind/date context

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
  v_report_date DATE;
  v_has_prof_override BOOLEAN;
  v_has_any_dept_wide BOOLEAN;
  v_allowed BOOLEAN;
  v_scope TEXT;
BEGIN
  v_department_id := COALESCE(NEW.subject_department_id, NEW.department_id);
  v_profession_role_id := NEW.subject_profession_id;
  v_entry_kind := COALESCE(NULLIF(NEW.entry_kind, ''), 'standard');
  v_report_kind := COALESCE(NULLIF(NEW.report_kind, ''), 'personal');
  v_report_date := NEW.date;

  IF v_department_id IS NULL OR v_report_date IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_report_kind IN ('department', 'mixed') THEN
    v_scope := 'dept_report';
    SELECT EXISTS(
      SELECT 1
      FROM public.scope_entry_kinds sek
      WHERE sek.department_id = v_department_id
        AND sek.scope_type = 'dept_report'
        AND sek.department_profession_id IS NULL
        AND sek.entry_kind = v_entry_kind
        AND public.is_entry_kind_available(
          sek.is_active,
          sek.is_available,
          NULL,
          NULL,
          sek.allowed_weekdays,
          v_report_date
        ) = TRUE
    ) INTO v_allowed;

    IF v_allowed THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'APP_ERROR:ENTRY_KIND_UNAVAILABLE'
      USING DETAIL = json_build_object(
        'scope', v_scope,
        'entry_kind', v_entry_kind,
        'date', to_char(v_report_date, 'YYYY-MM-DD'),
        'department_id', v_department_id::text,
        'profession_role_id', COALESCE(v_profession_role_id::text, null)
      )::text;
  END IF;

  -- Personal reporting: profession override applies only if there exists at least one available profession kind for this date.
  IF v_profession_role_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1
      FROM public.scope_entry_kinds sek
      WHERE sek.department_id = v_department_id
        AND sek.scope_type = 'profession_personal'
        AND sek.profession_role_id = v_profession_role_id
        AND public.is_entry_kind_available(
          sek.is_active,
          sek.is_available,
          NULL,
          NULL,
          sek.allowed_weekdays,
          v_report_date
        ) = TRUE
    ) INTO v_has_prof_override;
  ELSE
    v_has_prof_override := FALSE;
  END IF;

  IF v_has_prof_override THEN
    v_scope := 'profession_personal';
    SELECT EXISTS(
      SELECT 1
      FROM public.scope_entry_kinds sek
      WHERE sek.department_id = v_department_id
        AND sek.scope_type = 'profession_personal'
        AND sek.profession_role_id = v_profession_role_id
        AND sek.entry_kind = v_entry_kind
        AND public.is_entry_kind_available(
          sek.is_active,
          sek.is_available,
          NULL,
          NULL,
          sek.allowed_weekdays,
          v_report_date
        ) = TRUE
    ) INTO v_allowed;

    IF v_allowed THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'APP_ERROR:ENTRY_KIND_UNAVAILABLE'
      USING DETAIL = json_build_object(
        'scope', v_scope,
        'entry_kind', v_entry_kind,
        'date', to_char(v_report_date, 'YYYY-MM-DD'),
        'department_id', v_department_id::text,
        'profession_role_id', v_profession_role_id::text
      )::text;
  END IF;

  -- Dept-wide personal fallback.
  SELECT EXISTS(
    SELECT 1
    FROM public.scope_entry_kinds sek
    WHERE sek.department_id = v_department_id
      AND sek.scope_type = 'dept_wide_personal'
      AND sek.department_profession_id IS NULL
  ) INTO v_has_any_dept_wide;

  IF NOT v_has_any_dept_wide THEN
    RETURN NEW;
  END IF;

  v_scope := 'dept_wide_personal';
  SELECT EXISTS(
    SELECT 1
    FROM public.scope_entry_kinds sek
    WHERE sek.department_id = v_department_id
      AND sek.scope_type = 'dept_wide_personal'
      AND sek.department_profession_id IS NULL
      AND sek.entry_kind = v_entry_kind
      AND public.is_entry_kind_available(
        sek.is_active,
        sek.is_available,
        NULL,
        NULL,
        sek.allowed_weekdays,
        v_report_date
      ) = TRUE
  ) INTO v_allowed;

  IF v_allowed THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'APP_ERROR:ENTRY_KIND_UNAVAILABLE'
    USING DETAIL = json_build_object(
      'scope', v_scope,
      'entry_kind', v_entry_kind,
      'date', to_char(v_report_date, 'YYYY-MM-DD'),
      'department_id', v_department_id::text,
      'profession_role_id', COALESCE(v_profession_role_id::text, null)
    )::text;
END;
$$;

COMMIT;

