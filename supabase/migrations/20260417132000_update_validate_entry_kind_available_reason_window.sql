-- Update validate_entry_kind_available trigger to enforce:
-- - is_active
-- - is_available (manual suspension)
-- - available_start_date / available_end_date (inclusive window)
-- - allowed_weekdays (ISO 1=Mon..7=Sun)
-- ...all evaluated against NEW.date (report date).
--
-- Typed error contract:
--   MESSAGE: APP_ERROR:ENTRY_KIND_UNAVAILABLE
--   DETAIL: JSON with {scope, entry_kind, date, reason, department_id, profession_role_id, ...context}
--
-- Reason priority:
--   1 INACTIVE
--   2 SUSPENDED
--   3 OUT_OF_WINDOW
--   4 WEEKDAY_BLOCKED
--   5 NOT_CONFIGURED

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
  v_iso_dow SMALLINT;

  v_scope TEXT;
  v_reason TEXT;

  v_row RECORD;
  v_has_prof_override BOOLEAN;
  v_has_any_dept_wide BOOLEAN;
BEGIN
  v_department_id := COALESCE(NEW.subject_department_id, NEW.department_id);
  v_profession_role_id := NEW.subject_profession_id;
  v_entry_kind := COALESCE(NULLIF(NEW.entry_kind, ''), 'standard');
  v_report_kind := COALESCE(NULLIF(NEW.report_kind, ''), 'personal');
  v_report_date := NEW.date;

  IF v_department_id IS NULL OR v_report_date IS NULL THEN
    RETURN NEW;
  END IF;

  v_iso_dow := extract(isodow from v_report_date)::smallint;

  -- Helper: evaluate a specific scope row for reason priority.
  -- We implement inline by setting v_reason based on v_row fields.
  -- v_row may be null -> NOT_CONFIGURED.

  -- Dept report and mixed reports enforce dept_report.
  IF v_report_kind IN ('department', 'mixed') THEN
    v_scope := 'dept_report';

    SELECT *
    INTO v_row
    FROM public.scope_entry_kinds sek
    WHERE sek.department_id = v_department_id
      AND sek.scope_type = 'dept_report'
      AND sek.department_profession_id IS NULL
      AND sek.entry_kind = v_entry_kind
    LIMIT 1;

    IF v_row IS NULL THEN
      v_reason := 'NOT_CONFIGURED';
    ELSIF COALESCE(v_row.is_active, false) <> true THEN
      v_reason := 'INACTIVE';
    ELSIF COALESCE(v_row.is_available, false) <> true THEN
      v_reason := 'SUSPENDED';
    ELSIF (v_row.available_start_date IS NOT NULL AND v_row.available_start_date > v_report_date)
       OR (v_row.available_end_date IS NOT NULL AND v_row.available_end_date < v_report_date) THEN
      v_reason := 'OUT_OF_WINDOW';
    ELSIF v_row.allowed_weekdays IS NOT NULL
       AND array_length(v_row.allowed_weekdays, 1) IS NOT NULL
       AND NOT (v_iso_dow = ANY (v_row.allowed_weekdays)) THEN
      v_reason := 'WEEKDAY_BLOCKED';
    ELSE
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'APP_ERROR:ENTRY_KIND_UNAVAILABLE'
      USING DETAIL = json_build_object(
        'scope', v_scope,
        'entry_kind', v_entry_kind,
        'date', to_char(v_report_date, 'YYYY-MM-DD'),
        'reason', v_reason,
        'department_id', v_department_id::text,
        'profession_role_id', COALESCE(v_profession_role_id::text, null),
        'available_start_date', COALESCE(to_char(v_row.available_start_date, 'YYYY-MM-DD'), null),
        'available_end_date', COALESCE(to_char(v_row.available_end_date, 'YYYY-MM-DD'), null),
        'allowed_weekdays', v_row.allowed_weekdays
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
          sek.available_start_date,
          sek.available_end_date,
          sek.allowed_weekdays,
          v_report_date
        ) = TRUE
    ) INTO v_has_prof_override;
  ELSE
    v_has_prof_override := FALSE;
  END IF;

  IF v_has_prof_override THEN
    v_scope := 'profession_personal';

    SELECT *
    INTO v_row
    FROM public.scope_entry_kinds sek
    WHERE sek.department_id = v_department_id
      AND sek.scope_type = 'profession_personal'
      AND sek.profession_role_id = v_profession_role_id
      AND sek.entry_kind = v_entry_kind
    LIMIT 1;

    IF v_row IS NULL THEN
      v_reason := 'NOT_CONFIGURED';
    ELSIF COALESCE(v_row.is_active, false) <> true THEN
      v_reason := 'INACTIVE';
    ELSIF COALESCE(v_row.is_available, false) <> true THEN
      v_reason := 'SUSPENDED';
    ELSIF (v_row.available_start_date IS NOT NULL AND v_row.available_start_date > v_report_date)
       OR (v_row.available_end_date IS NOT NULL AND v_row.available_end_date < v_report_date) THEN
      v_reason := 'OUT_OF_WINDOW';
    ELSIF v_row.allowed_weekdays IS NOT NULL
       AND array_length(v_row.allowed_weekdays, 1) IS NOT NULL
       AND NOT (v_iso_dow = ANY (v_row.allowed_weekdays)) THEN
      v_reason := 'WEEKDAY_BLOCKED';
    ELSE
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'APP_ERROR:ENTRY_KIND_UNAVAILABLE'
      USING DETAIL = json_build_object(
        'scope', v_scope,
        'entry_kind', v_entry_kind,
        'date', to_char(v_report_date, 'YYYY-MM-DD'),
        'reason', v_reason,
        'department_id', v_department_id::text,
        'profession_role_id', v_profession_role_id::text,
        'available_start_date', COALESCE(to_char(v_row.available_start_date, 'YYYY-MM-DD'), null),
        'available_end_date', COALESCE(to_char(v_row.available_end_date, 'YYYY-MM-DD'), null),
        'allowed_weekdays', v_row.allowed_weekdays
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

  -- Backward compatibility: if no dept-wide config rows exist at all, allow inserts (legacy behavior).
  IF NOT v_has_any_dept_wide THEN
    RETURN NEW;
  END IF;

  v_scope := 'dept_wide_personal';

  SELECT *
  INTO v_row
  FROM public.scope_entry_kinds sek
  WHERE sek.department_id = v_department_id
    AND sek.scope_type = 'dept_wide_personal'
    AND sek.department_profession_id IS NULL
    AND sek.entry_kind = v_entry_kind
  LIMIT 1;

  IF v_row IS NULL THEN
    v_reason := 'NOT_CONFIGURED';
  ELSIF COALESCE(v_row.is_active, false) <> true THEN
    v_reason := 'INACTIVE';
  ELSIF COALESCE(v_row.is_available, false) <> true THEN
    v_reason := 'SUSPENDED';
  ELSIF (v_row.available_start_date IS NOT NULL AND v_row.available_start_date > v_report_date)
     OR (v_row.available_end_date IS NOT NULL AND v_row.available_end_date < v_report_date) THEN
    v_reason := 'OUT_OF_WINDOW';
  ELSIF v_row.allowed_weekdays IS NOT NULL
     AND array_length(v_row.allowed_weekdays, 1) IS NOT NULL
     AND NOT (v_iso_dow = ANY (v_row.allowed_weekdays)) THEN
    v_reason := 'WEEKDAY_BLOCKED';
  ELSE
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'APP_ERROR:ENTRY_KIND_UNAVAILABLE'
    USING DETAIL = json_build_object(
      'scope', v_scope,
      'entry_kind', v_entry_kind,
      'date', to_char(v_report_date, 'YYYY-MM-DD'),
      'reason', v_reason,
      'department_id', v_department_id::text,
      'profession_role_id', COALESCE(v_profession_role_id::text, null),
      'available_start_date', COALESCE(to_char(v_row.available_start_date, 'YYYY-MM-DD'), null),
      'available_end_date', COALESCE(to_char(v_row.available_end_date, 'YYYY-MM-DD'), null),
      'allowed_weekdays', v_row.allowed_weekdays
    )::text;
END;
$$;

COMMIT;

