BEGIN;

ALTER TABLE public.department_roles
  DROP COLUMN IF EXISTS default_can_answer_department_questions;

COMMIT;
