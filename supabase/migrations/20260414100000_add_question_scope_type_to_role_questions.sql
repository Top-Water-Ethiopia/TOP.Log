-- Add explicit question_scope_type to role_questions so department-wide personal questions
-- can coexist with department-report questions (both department_id-scoped, no profession).

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_scope_type_enum') THEN
    CREATE TYPE question_scope_type_enum AS ENUM ('dept_wide_personal', 'profession_personal', 'dept_report');
  END IF;
END$$;

ALTER TABLE public.role_questions
  ADD COLUMN IF NOT EXISTS question_scope_type question_scope_type_enum;

-- Backfill existing rows:
-- If profession identifiers exist, treat as profession_personal, otherwise assume dept_report (legacy department scope).
UPDATE public.role_questions
SET question_scope_type = CASE
  WHEN department_profession_id IS NOT NULL OR department_role IS NOT NULL THEN 'profession_personal'::question_scope_type_enum
  ELSE 'dept_report'::question_scope_type_enum
END
WHERE question_scope_type IS NULL;

ALTER TABLE public.role_questions
  ALTER COLUMN question_scope_type SET NOT NULL;

-- Index to help scope filtering
CREATE INDEX IF NOT EXISTS idx_role_questions_scope_type
  ON public.role_questions(department_id, question_scope_type, department_profession_id);

COMMIT;

