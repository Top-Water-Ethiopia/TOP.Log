BEGIN;

ALTER TABLE public.role_questions
  ADD COLUMN IF NOT EXISTS department_id UUID NULL REFERENCES public.departments(id) ON DELETE CASCADE;

ALTER TABLE public.role_questions
  ALTER COLUMN role_id DROP NOT NULL;

ALTER TABLE public.role_questions
  DROP CONSTRAINT IF EXISTS role_questions_scope_check;

ALTER TABLE public.role_questions
  ADD CONSTRAINT role_questions_scope_check
  CHECK ((role_id IS NULL) <> (department_id IS NULL));

CREATE INDEX IF NOT EXISTS idx_role_questions_department_id
  ON public.role_questions(department_id)
  WHERE department_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_role_questions_department_display_order
  ON public.role_questions(department_id, display_order)
  WHERE department_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.can_view_department_questions(p_department_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_department_roles udr
    WHERE udr.user_id = v_user_id
      AND udr.department_id = p_department_id
      AND udr.is_active = TRUE
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_view_department_questions(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can view questions for their role" ON public.role_questions;
DROP POLICY IF EXISTS "Users can view questions for their scope" ON public.role_questions;

CREATE POLICY "Users can view questions for their scope"
  ON public.role_questions FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND (
      (
        role_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.user_department_professions udp
          JOIN public.roles r
            ON r.id = udp.role_id
          WHERE udp.user_id = auth.uid()
            AND udp.role_id = public.role_questions.role_id
            AND udp.is_active = true
            AND r.department_id IS NOT NULL
            AND public.can_view_department_questions(r.department_id)
        )
      )
      OR (
        department_id IS NOT NULL
        AND public.can_view_department_questions(department_id)
      )
    )
  );

COMMIT;
