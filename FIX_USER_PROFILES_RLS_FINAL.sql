-- FINAL FIX: Ensure user_profiles RLS policy works correctly
-- The issue: SELECT with specific columns returns [] but SELECT * works
-- This suggests the RLS policy might need to be recreated

BEGIN;

-- Step 1: Check current RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'user_profiles';

-- Step 2: Drop ALL existing SELECT policies
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

-- Step 3: Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Step 4: Create the policy - using the simplest possible syntax
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Step 5: Verify the policy
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_profiles'
  AND cmd = 'SELECT';

COMMIT;

-- Test: This should return your profile now
-- Replace with your user_id if different
SELECT 
  id,
  user_id,
  name,
  role_id,
  is_active
FROM user_profiles
WHERE user_id = 'ccb4613c-3e6d-4421-8b1c-3277280d658c';

-- Test with specific columns (this is what the code uses)
SELECT 
  role_id,
  is_active,
  user_id
FROM user_profiles
WHERE user_id = 'ccb4613c-3e6d-4421-8b1c-3277280d658c';

