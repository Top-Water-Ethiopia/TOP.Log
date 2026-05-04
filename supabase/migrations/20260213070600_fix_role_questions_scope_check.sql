-- Fix role_questions scope constraint for department_id + optional department_role

BEGIN;

-- Ensure role_id is not used in the new scoping model
UPDATE public.role_questions
SET role_id = NULL
WHERE role_id IS NOT NULL;

ALTER TABLE public.role_questions
  DROP CONSTRAINT IF EXISTS role_questions_scope_check;

-- New rule:
-- - department_id is always required
-- - department_role is optional (NULL for department-wide, set for department+role scope)
-- - role_id must be NULL
ALTER TABLE public.role_questions
  ADD CONSTRAINT role_questions_scope_check
  CHECK (
    department_id IS NOT NULL
    AND role_id IS NULL
  );

COMMIT;
