-- Add department-based scoping to report_questions
BEGIN;

-- Add new columns if they do not already exist
ALTER TABLE public.report_questions
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Ensure metadata has a default jsonb object
UPDATE public.report_questions
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

ALTER TABLE public.report_questions
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

-- Drop legacy unique constraint if present
ALTER TABLE public.report_questions
  DROP CONSTRAINT IF EXISTS report_questions_role_id_question_key_key;

-- Create scoped unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS report_questions_department_question_key_idx
  ON public.report_questions (question_key, department)
  WHERE department IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS report_questions_role_question_key_idx
  ON public.report_questions (question_key, role_id)
  WHERE department IS NULL;

-- Helpful indexes for querying by department/role
CREATE INDEX IF NOT EXISTS idx_report_questions_department
  ON public.report_questions (department);

CREATE INDEX IF NOT EXISTS idx_report_questions_role_department
  ON public.report_questions (role_id, department);

-- Update RLS policy to allow admins to manage questions
DROP POLICY IF EXISTS "Enable insert for admins" ON public.report_questions;
DROP POLICY IF EXISTS "Enable update for admins" ON public.report_questions;
DROP POLICY IF EXISTS "Enable delete for admins" ON public.report_questions;

CREATE POLICY "Enable read access for all users"
  ON public.report_questions
  FOR SELECT
  USING (true);

CREATE POLICY "Enable write access for admins"
  ON public.report_questions
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role_id = '00000000-0000-0000-0000-000000000001'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role_id = '00000000-0000-0000-0000-000000000001'
    )
  );

COMMIT;
