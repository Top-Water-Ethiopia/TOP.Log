-- FINAL FIX: Use SECURITY DEFINER function to bypass RLS issues
-- This is the most reliable approach - uses the same pattern but bypasses RLS
-- Run this in Supabase SQL Editor

BEGIN;

-- ============================================================================
-- STEP 1: Create SECURITY DEFINER function to check admin status
-- This bypasses RLS when checking user_profiles
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin_or_super_admin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_id UUID;
  is_active_val BOOLEAN;
BEGIN
  -- Get the user's role_id and is_active status
  -- SECURITY DEFINER means this bypasses RLS on user_profiles
  SELECT role_id, is_active 
  INTO user_role_id, is_active_val
  FROM public.user_profiles
  WHERE user_id = user_uuid;
  
  -- Return false if user doesn't exist or is inactive
  IF user_role_id IS NULL OR is_active_val = false THEN
    RETURN false;
  END IF;
  
  -- Check if user is admin or super admin
  IF user_role_id = '00000000-0000-0000-0000-000000000001'::UUID OR 
     user_role_id = '00000000-0000-0000-0000-000000000000'::UUID THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin_or_super_admin(UUID) TO authenticated;

-- ============================================================================
-- STEP 2: Fix user_profiles RLS (still needed for client queries)
-- ============================================================================

-- Drop all existing SELECT policies
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'user_profiles' 
    AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_profiles', policy_record.policyname);
  END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policy for client queries
CREATE POLICY "Users can view their own profile"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 3: Apply role_questions RLS using the function
-- This bypasses the RLS issue because the function doesn't use RLS
-- ============================================================================

-- Ensure RLS is enabled
ALTER TABLE public.role_questions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view questions for their role" ON role_questions;
DROP POLICY IF EXISTS "Admins can view all role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can create role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can update role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can delete role questions" ON role_questions;

-- Users can view active questions for their role
CREATE POLICY "Users can view questions for their role"
  ON public.role_questions FOR SELECT
  TO authenticated
  USING (
    is_active = true AND
    role_id IN (
      SELECT role_id FROM public.user_profiles WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Admins and super admins can view all questions
-- Uses the function instead of direct EXISTS check
CREATE POLICY "Admins can view all role questions"
  ON public.role_questions FOR SELECT
  TO authenticated
  USING (public.is_admin_or_super_admin(auth.uid()));

-- Admins and super admins can create questions
-- Uses the function - this bypasses RLS issues!
CREATE POLICY "Admins can create role questions"
  ON public.role_questions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_super_admin(auth.uid()));

-- Admins and super admins can update questions
-- Uses the function
CREATE POLICY "Admins can update role questions"
  ON public.role_questions FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_super_admin(auth.uid()))
  WITH CHECK (public.is_admin_or_super_admin(auth.uid()));

-- Admins and super admins can delete questions
-- Uses the function
CREATE POLICY "Admins can delete role questions"
  ON public.role_questions FOR DELETE
  TO authenticated
  USING (public.is_admin_or_super_admin(auth.uid()));

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test 1: Test the function directly
SELECT 
  'Function Test' as test_type,
  public.is_admin_or_super_admin('ccb4613c-3e6d-4421-8b1c-3277280d658c'::UUID) as function_result,
  CASE 
    WHEN public.is_admin_or_super_admin('ccb4613c-3e6d-4421-8b1c-3277280d658c'::UUID) 
    THEN '✅ Function returns TRUE - INSERT will work!'
    ELSE '❌ Function returns FALSE - Check your profile'
  END as test_result;

-- Test 2: Verify policies
SELECT 
  'role_questions' as table_name,
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'INSERT' THEN 'Create'
    WHEN cmd = 'UPDATE' THEN 'Update'
    ELSE cmd
  END as operation
FROM pg_policies
WHERE tablename = 'role_questions'
  AND cmd IN ('INSERT', 'UPDATE')
ORDER BY cmd;

-- Test 3: Verify user_profiles policy
SELECT 
  'user_profiles' as table_name,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'user_profiles'
  AND cmd = 'SELECT';

