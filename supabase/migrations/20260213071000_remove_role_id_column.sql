-- Remove role_id column from role_questions table since it's no longer used

BEGIN;

-- First, ensure all role_id values are NULL (they should already be from the previous migration)
UPDATE public.role_questions
SET role_id = NULL
WHERE role_id IS NOT NULL;

-- Drop the RLS policy that depends on role_id
DROP POLICY IF EXISTS "Users can view questions for their scope" ON public.role_questions;

-- Drop the constraint that references role_id
ALTER TABLE public.role_questions
  DROP CONSTRAINT IF EXISTS role_questions_scope_check;

-- Add the updated constraint that doesn't reference role_id
ALTER TABLE public.role_questions
  ADD CONSTRAINT role_questions_scope_check
  CHECK (
    department_id IS NOT NULL
  );

-- Now drop the role_id column
ALTER TABLE public.role_questions
  DROP COLUMN IF EXISTS role_id;

-- Recreate the RLS policy without role_id dependency (only department-based access)
CREATE POLICY "Users can view questions for their scope"
  ON public.role_questions FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND department_id IS NOT NULL
    AND public.can_view_department_questions(department_id)
  );

COMMIT;
