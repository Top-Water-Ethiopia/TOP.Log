-- Fix RLS policies for roles and role_questions tables
-- This allows admins and super admins to access both tables

BEGIN;

-- ============================================
-- FIX ROLES TABLE RLS POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view all roles" ON roles;
DROP POLICY IF EXISTS "Users can view roles" ON roles;
DROP POLICY IF EXISTS "Public can view roles" ON roles;
DROP POLICY IF EXISTS "Authenticated users can view roles" ON roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON roles;

-- Allow all authenticated users to view roles (needed for dropdowns, etc.)
CREATE POLICY "Authenticated users can view roles"
  ON roles FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins and super admins to manage roles
CREATE POLICY "Admins can manage roles"
  ON roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
    )
  );

-- ============================================
-- FIX ROLE_QUESTIONS TABLE RLS POLICIES
-- ============================================

-- Drop existing admin policies
DROP POLICY IF EXISTS "Admins can view all role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can create role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can update role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can delete role questions" ON role_questions;

-- Users can view active questions for their role
DROP POLICY IF EXISTS "Users can view questions for their role" ON role_questions;
CREATE POLICY "Users can view questions for their role"
  ON role_questions FOR SELECT
  TO authenticated
  USING (
    is_active = true AND
    role_id IN (
      SELECT role_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- Admins and super admins can view all questions
CREATE POLICY "Admins can view all role questions"
  ON role_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
    )
  );

-- Admins and super admins can create questions
CREATE POLICY "Admins can create role questions"
  ON role_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
    )
  );

-- Admins and super admins can update questions
CREATE POLICY "Admins can update role questions"
  ON role_questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
    )
  );

-- Admins and super admins can delete questions
CREATE POLICY "Admins can delete role questions"
  ON role_questions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
    )
  );

COMMIT;





