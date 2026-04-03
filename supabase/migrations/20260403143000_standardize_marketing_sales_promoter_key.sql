BEGIN;

DO $$
DECLARE
  marketing_department_id uuid;
  legacy_profession_id uuid;
  canonical_profession_id uuid;
BEGIN
  SELECT id
  INTO marketing_department_id
  FROM public.departments
  WHERE lower(name) = lower('Marketing')
  ORDER BY created_at ASC
  LIMIT 1;

  IF marketing_department_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id
  INTO legacy_profession_id
  FROM public.department_professions
  WHERE department_id = marketing_department_id
    AND key = 'sales_promoter'
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT id
  INTO canonical_profession_id
  FROM public.department_professions
  WHERE department_id = marketing_department_id
    AND key = 'sales-promoter'
  ORDER BY created_at ASC
  LIMIT 1;

  IF legacy_profession_id IS NOT NULL AND canonical_profession_id IS NULL THEN
    UPDATE public.department_professions
    SET
      key = 'sales-promoter',
      label = 'Sales Promoter',
      updated_at = now()
    WHERE id = legacy_profession_id;

    canonical_profession_id := legacy_profession_id;
    legacy_profession_id := NULL;
  ELSIF canonical_profession_id IS NOT NULL THEN
    UPDATE public.department_professions
    SET
      label = CASE
        WHEN lower(trim(label)) IN ('sales_promoter', 'sales-promoter', 'sales promoter') THEN 'Sales Promoter'
        ELSE label
      END,
      updated_at = now()
    WHERE id = canonical_profession_id;
  END IF;

  IF legacy_profession_id IS NOT NULL AND canonical_profession_id IS NOT NULL THEN
    UPDATE public.user_department_professions
    SET
      department_role_id = canonical_profession_id,
      role = 'sales-promoter',
      updated_at = now()
    WHERE department_id = marketing_department_id
      AND (
        department_role_id = legacy_profession_id
        OR role = 'sales_promoter'
      );

    UPDATE public.role_questions
    SET
      department_profession_id = canonical_profession_id,
      department_role = 'sales-promoter',
      metadata = CASE
        WHEN metadata IS NULL THEN NULL
        WHEN metadata::text LIKE '%sales_promoter%' THEN replace(metadata::text, 'sales_promoter', 'sales-promoter')::jsonb
        ELSE metadata
      END,
      updated_at = now()
    WHERE department_id = marketing_department_id
      AND (
        department_profession_id = legacy_profession_id
        OR department_role = 'sales_promoter'
        OR COALESCE(metadata::text, '') LIKE '%sales_promoter%'
      );

    UPDATE public.captain_log_entries
    SET subject_profession_id = canonical_profession_id
    WHERE subject_department_id = marketing_department_id
      AND subject_profession_id = legacy_profession_id;

    DELETE FROM public.department_professions
    WHERE id = legacy_profession_id;
  END IF;

  UPDATE public.user_department_professions
  SET
    role = 'sales-promoter',
    updated_at = now()
  WHERE department_id = marketing_department_id
    AND role = 'sales_promoter';

  UPDATE public.role_questions
  SET
    department_role = 'sales-promoter',
    metadata = CASE
      WHEN metadata IS NULL THEN NULL
      WHEN metadata::text LIKE '%sales_promoter%' THEN replace(metadata::text, 'sales_promoter', 'sales-promoter')::jsonb
      ELSE metadata
    END,
    updated_at = now()
  WHERE department_id = marketing_department_id
    AND (
      department_role = 'sales_promoter'
      OR COALESCE(metadata::text, '') LIKE '%sales_promoter%'
    );
END;
$$;

COMMIT;
