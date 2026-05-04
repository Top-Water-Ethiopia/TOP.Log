-- Migration: fix role_questions RLS for unified roles
-- Path: supabase/migrations/20260414110000_fix_role_questions_rls.sql

BEGIN;

-- Drop the broken legacy policy
DROP POLICY IF EXISTS "Users can view questions for their role" ON role_questions;

-- Create a new policy that allows users to see questions for their department and role
-- A user can see a question if:
-- 1. It is active
-- 2. It is scoped to a department they are a member of
-- 3. If it has a profession requirement, it matches their assigned profession (by ID or legacy key)
CREATE POLICY "Users can view questions for their department and role"
  ON role_questions FOR SELECT
  TO authenticated
  USING (
    is_active = true AND
    department_id IN (
      SELECT department_id FROM user_department_memberships
      WHERE user_id = auth.uid() AND is_active = true
    ) AND (
      -- Dep-wide personal questions or Dep-report questions (no profession scope)
      (department_profession_id IS NULL AND department_role IS NULL)
      OR
      -- Profession-specific questions (match by ID or Name)
      EXISTS (
        SELECT 1 FROM user_department_memberships udm
        JOIN roles r ON r.id = udm.role_id
        WHERE udm.user_id = auth.uid()
          AND udm.department_id = role_questions.department_id
          AND udm.is_active = true
          AND udm.membership_type = 'profession'
          AND (
            udm.role_id = role_questions.department_profession_id
            OR r.name = role_questions.department_role
          )
      )
    )
  );

COMMIT;
