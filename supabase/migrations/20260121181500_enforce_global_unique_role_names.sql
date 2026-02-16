BEGIN;

-- Enforce globally unique role names across system-wide and department-scoped roles.
-- This migration will fail if duplicates already exist.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.roles
    GROUP BY name
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce global unique roles.name: duplicate role names exist. Resolve duplicates before applying this migration.';
  END IF;
END $$;

DROP INDEX IF EXISTS public.roles_unique_system_name;
DROP INDEX IF EXISTS public.roles_unique_department_name;

ALTER TABLE public.roles
  DROP CONSTRAINT IF EXISTS roles_name_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'roles'
      AND c.conname = 'roles_name_unique'
  ) THEN
    ALTER TABLE public.roles
      ADD CONSTRAINT roles_name_unique UNIQUE (name);
  END IF;
END $$;

COMMIT;
