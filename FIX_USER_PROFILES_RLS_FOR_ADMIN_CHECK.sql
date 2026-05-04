-- Fix user_profiles RLS to allow RLS policy checks to work
-- This ensures that when role_questions RLS checks user_profiles, it can see the profile

BEGIN;

-- The issue: When role_questions RLS policy does:
--   EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND ...)
-- The user_profiles RLS might block this check if the policy is too restrictive

-- Ensure users can view their own profile (this should already exist)
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;

CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Also add a policy that allows the RLS check to work for admins/super admins
-- This ensures that when role_questions policy checks user_profiles,
-- it can see the profile for RLS validation purposes
-- Note: This might already be covered by the above policy, but we want to be explicit

-- Verify the policy exists
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'user_profiles'
  AND policyname = 'Users can view their own profile';
  
  IF policy_count >= 1 THEN
    RAISE NOTICE '✅ user_profiles SELECT policy exists';
  ELSE
    RAISE WARNING '⚠️  user_profiles SELECT policy not found';
  END IF;
END $$;

COMMIT;

-- Verify user_profiles policies
SELECT 
  policyname, 
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'user_profiles' 
ORDER BY policyname;

