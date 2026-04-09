BEGIN;

DROP INDEX IF EXISTS public.captain_log_entries_standard_unique;

CREATE OR REPLACE FUNCTION public.enforce_standard_entry_uniqueness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profession_key TEXT;
  v_allow_multiple_per_day BOOLEAN := FALSE;
BEGIN
  IF NEW.entry_kind IS DISTINCT FROM 'standard' THEN
    RETURN NEW;
  END IF;

  IF NEW.submitted_by_user_id IS NULL OR NEW.subject_department_id IS NULL OR NEW.date IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.subject_profession_id IS NOT NULL THEN
    SELECT dp.key
    INTO v_profession_key
    FROM public.department_professions dp
    WHERE dp.id = NEW.subject_profession_id;
  END IF;

  SELECT COALESCE(sek.allow_multiple_per_day, FALSE)
  INTO v_allow_multiple_per_day
  FROM public.scope_entry_kinds sek
  WHERE sek.department_id = NEW.subject_department_id
    AND sek.entry_kind = 'standard'
    AND (
      (v_profession_key IS NULL AND sek.department_profession_id IS NULL)
      OR sek.department_profession_id = v_profession_key
    )
  ORDER BY sek.department_profession_id NULLS FIRST
  LIMIT 1;

  IF v_allow_multiple_per_day THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.captain_log_entries cle
    WHERE cle.id <> NEW.id
      AND cle.entry_kind = 'standard'
      AND cle.submitted_by_user_id = NEW.submitted_by_user_id
      AND cle.subject_department_id = NEW.subject_department_id
      AND cle.date = NEW.date
  ) THEN
    RAISE EXCEPTION
      USING
        ERRCODE = '23505',
        CONSTRAINT = 'captain_log_entries_standard_unique',
        MESSAGE = 'A standard report already exists for this user, department, and date';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_standard_entry_uniqueness ON public.captain_log_entries;

CREATE TRIGGER trg_enforce_standard_entry_uniqueness
  BEFORE INSERT OR UPDATE ON public.captain_log_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_standard_entry_uniqueness();

COMMIT;
