BEGIN;

DO $$
BEGIN
  IF to_regclass('public.department_professions') IS NULL
     AND to_regclass('public.department_roles') IS NOT NULL THEN
    ALTER TABLE public.department_roles RENAME TO department_professions;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.user_department_professions') IS NULL
     AND to_regclass('public.user_department_roles') IS NOT NULL THEN
    ALTER TABLE public.user_department_roles RENAME TO user_department_professions;
  ELSIF to_regclass('public.user_department_professions') IS NOT NULL
        AND to_regclass('public.user_department_roles') IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot rename user_department_roles to user_department_professions because the target table already exists.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'department_roles_pkey'
      AND conrelid = 'public.department_professions'::regclass
  ) THEN
    ALTER TABLE public.department_professions
      RENAME CONSTRAINT department_roles_pkey TO department_professions_pkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'department_roles_key_unique'
      AND conrelid = 'public.department_professions'::regclass
  ) THEN
    ALTER TABLE public.department_professions
      RENAME CONSTRAINT department_roles_key_unique TO department_professions_key_unique;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'department_roles_department_id_fkey'
      AND conrelid = 'public.department_professions'::regclass
  ) THEN
    ALTER TABLE public.department_professions
      RENAME CONSTRAINT department_roles_department_id_fkey TO department_professions_department_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_department_roles_pkey'
      AND conrelid = 'public.user_department_professions'::regclass
  ) THEN
    ALTER TABLE public.user_department_professions
      RENAME CONSTRAINT user_department_roles_pkey TO user_department_professions_pkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_department_roles_user_id_fkey'
      AND conrelid = 'public.user_department_professions'::regclass
  ) THEN
    ALTER TABLE public.user_department_professions
      RENAME CONSTRAINT user_department_roles_user_id_fkey TO user_department_professions_user_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_department_roles_department_id_fkey'
      AND conrelid = 'public.user_department_professions'::regclass
  ) THEN
    ALTER TABLE public.user_department_professions
      RENAME CONSTRAINT user_department_roles_department_id_fkey TO user_department_professions_department_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_department_roles_department_role_id_fkey'
      AND conrelid = 'public.user_department_professions'::regclass
  ) THEN
    ALTER TABLE public.user_department_professions
      RENAME CONSTRAINT user_department_roles_department_role_id_fkey TO user_department_professions_department_profession_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_user_department_roles_department_role'
      AND conrelid = 'public.user_department_professions'::regclass
  ) THEN
    ALTER TABLE public.user_department_professions
      RENAME CONSTRAINT fk_user_department_roles_department_role TO fk_user_department_professions_department_profession;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_department_roles_created_by_fkey'
      AND conrelid = 'public.user_department_professions'::regclass
  ) THEN
    ALTER TABLE public.user_department_professions
      RENAME CONSTRAINT user_department_roles_created_by_fkey TO user_department_professions_created_by_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_department_roles_updated_by_fkey'
      AND conrelid = 'public.user_department_professions'::regclass
  ) THEN
    ALTER TABLE public.user_department_professions
      RENAME CONSTRAINT user_department_roles_updated_by_fkey TO user_department_professions_updated_by_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_department_roles_user_id_department_id_key'
      AND conrelid = 'public.user_department_professions'::regclass
  ) THEN
    ALTER TABLE public.user_department_professions
      RENAME CONSTRAINT user_department_roles_user_id_department_id_key TO user_department_professions_user_id_department_id_key;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_department_roles_user_dept_unique'
      AND conrelid = 'public.user_department_professions'::regclass
  ) THEN
    ALTER TABLE public.user_department_professions
      RENAME CONSTRAINT user_department_roles_user_dept_unique TO user_department_professions_user_dept_unique;
  END IF;
END $$;

ALTER INDEX IF EXISTS public.department_roles_pkey
  RENAME TO department_professions_pkey;
ALTER INDEX IF EXISTS public.department_roles_key_unique
  RENAME TO department_professions_key_unique;
ALTER INDEX IF EXISTS public.department_roles_department_id_is_active_idx
  RENAME TO department_professions_department_id_is_active_idx;
ALTER INDEX IF EXISTS public.department_roles_single_default_per_dept
  RENAME TO department_professions_single_default_per_dept;
ALTER INDEX IF EXISTS public.department_roles_single_global_default
  RENAME TO department_professions_single_global_default;
ALTER INDEX IF EXISTS public.idx_department_roles_department_id
  RENAME TO idx_department_professions_department_id;
ALTER INDEX IF EXISTS public.idx_department_roles_department_id_sort_order
  RENAME TO idx_department_professions_department_id_sort_order;

ALTER INDEX IF EXISTS public.user_department_roles_pkey
  RENAME TO user_department_professions_pkey;
ALTER INDEX IF EXISTS public.idx_user_department_roles_user
  RENAME TO idx_user_department_professions_user;
ALTER INDEX IF EXISTS public.idx_user_department_roles_department
  RENAME TO idx_user_department_professions_department;
ALTER INDEX IF EXISTS public.user_department_roles_department_id_is_active_idx
  RENAME TO user_department_professions_department_id_is_active_idx;
ALTER INDEX IF EXISTS public.user_department_roles_one_active_membership_per_user
  RENAME TO user_department_professions_one_active_membership_per_user;
ALTER INDEX IF EXISTS public.user_department_roles_user_dept_unique
  RENAME TO user_department_professions_user_dept_unique;
ALTER INDEX IF EXISTS public.user_department_roles_user_id_department_id_key
  RENAME TO user_department_professions_user_id_department_id_key;

COMMIT;
