-- FIX RLS using SECURITY DEFINER function approach
-- This bypasses RLS issues by using a function that runs with elevated privileges
-- Run this in Supabase SQL Editor

BEGIN;

-- ============================================================================
-- Step 1: Create a SECURITY DEFINER function to check admin status
-- This function bypasses RLS when checking user_profiles
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
  -- This bypasses RLS because it's SECURITY DEFINER
  SELECT role_id, is_active 
  INTO user_role_id, is_active_val
  FROM public.user_profiles
  WHERE user_id = user_uuid;
  
  -- Check if user exists, is active, and is admin or super admin
  IF user_role_id IS NULL OR is_active_val = false THEN
    RETURN false;
  END IF;
  
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
-- Step 2: Fix user_profiles RLS (still need this for client queries)
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
    RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
  END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create the policy
CREATE POLICY "Users can view their own profile"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- Step 3: Fix role_questions INSERT policy to use the function
-- ============================================================================

-- Ensure RLS is enabled
ALTER TABLE public.role_questions ENABLE ROW LEVEL SECURITY;

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Admins can create role questions" ON public.role_questions;

-- Create INSERT policy using the SECURITY DEFINER function
-- This avoids RLS issues when checking user_profiles
CREATE POLICY "Admins can create role questions"
  ON public.role_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_super_admin(auth.uid())
  );

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test the function directly
SELECT 
  'Function Test' as test_type,
  public.is_admin_or_super_admin('ccb4613c-3e6d-4421-8b1c-3277280d658c'::UUID) as is_admin_check,
  CASE 
    WHEN public.is_admin_or_super_admin('ccb4613c-3e6d-4421-8b1c-3277280d658c'::UUID) 
    THEN '✅ Function returns TRUE - INSERT should work'
    ELSE '❌ Function returns FALSE - INSERT will be blocked'
  END as test_result;

-- Verify the INSERT policy
SELECT 
  'role_questions' as table_name,
  policyname,
  cmd,
  with_check as policy_condition
FROM pg_policies
WHERE tablename = 'role_questions'
  AND cmd = 'INSERT';

-- Verify user_profiles policy
SELECT 
  'user_profiles' as table_name,
  policyname,
  cmd,
  qual as policy_condition
FROM pg_policies
WHERE tablename = 'user_profiles'
  AND cmd = 'SELECT';

