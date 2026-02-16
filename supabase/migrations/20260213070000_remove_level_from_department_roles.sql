BEGIN;

-- Remove the level column from department_roles table
ALTER TABLE IF EXISTS public.department_roles
  DROP COLUMN IF EXISTS level;

COMMIT;
