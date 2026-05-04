-- URGENT FIX: Fix user_profiles RLS so clients can read their own profile
-- This is blocking role_questions INSERT because the policy check can't see the profile
-- Run this FIRST in Supabase SQL Editor

BEGIN;

-- Step 1: Check current policies (informational)
SELECT 
  policyname,
  cmd,
  schemaname,
  tablename
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY cmd, policyname;

-- Step 2: Drop ALL existing SELECT policies on user_profiles
-- We'll recreate them cleanly
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

-- Step 3: Create a simple, working policy that allows users to read their own profile
-- This MUST work for the role_questions INSERT policy check to succeed
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Step 4: Verify the policy was created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'user_profiles'
  AND cmd = 'SELECT'
  AND policyname = 'Users can view their own profile';
  
  IF policy_count >= 1 THEN
    RAISE NOTICE '✅ Policy created successfully';
  ELSE
    RAISE EXCEPTION '❌ Policy creation failed!';
  END IF;
END $$;

COMMIT;

-- Verification: List all user_profiles policies
SELECT 
  policyname,
  cmd,
  qual as policy_condition,
  with_check
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY cmd, policyname;

-- Test query (this should work from the client now)
-- Replace with your user_id if different
SELECT 
  id,
  user_id,
  name,
  role_id,
  is_active,
  CASE 
    WHEN auth.uid() = user_id THEN '✅ You can see your own profile'
    ELSE '❌ Policy issue'
  END as test_result
FROM user_profiles
WHERE user_id = 'ccb4613c-3e6d-4421-8b1c-3277280d658c'; -- ⚠️ Replace with your user_id if needed

