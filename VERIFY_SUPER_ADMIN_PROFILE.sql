-- Verify Super Admin Profile and RLS Check
-- Run this in Supabase SQL Editor to check if your profile is correctly configured

-- Step 1: Find your user ID from the auth.users table
-- Replace 'your-email@example.com' with your actual email
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
WHERE email = 'your-email@example.com';  -- ⚠️ REPLACE WITH YOUR EMAIL

-- Step 2: Check your profile (replace the UUID with your user_id from Step 1)
SELECT 
  up.id,
  up.user_id,
  up.name,
  up.role_id,
  r.name as role_name,
  up.is_active,
  up.created_at,
  up.updated_at
FROM user_profiles up
LEFT JOIN roles r ON r.id = up.role_id
WHERE up.user_id = 'REPLACE_WITH_YOUR_USER_ID';  -- ⚠️ REPLACE WITH YOUR USER_ID FROM STEP 1

-- Step 3: Verify the role IDs
SELECT 
  id,
  name,
  description
FROM roles
WHERE id IN (
  '00000000-0000-0000-0000-000000000000',  -- Super Admin
  '00000000-0000-0000-0000-000000000001',  -- Admin
  '00000000-0000-0000-0000-000000000002'   -- User
)
ORDER BY id;

-- Step 4: Test if the RLS check would pass (replace with your user_id)
-- This simulates what the role_questions INSERT policy checks
DO $$
DECLARE
  v_user_id UUID := 'REPLACE_WITH_YOUR_USER_ID';  -- ⚠️ REPLACE WITH YOUR USER_ID
  v_check_passes BOOLEAN;
BEGIN
  -- This is what the role_questions INSERT policy checks:
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = v_user_id
    AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID  -- Admin
         OR role_id = '00000000-0000-0000-0000-000000000000'::UUID)  -- Super Admin
    AND is_active = true
  ) INTO v_check_passes;
  
  IF v_check_passes THEN
    RAISE NOTICE '✅ RLS check WOULD PASS - You should be able to create role_questions';
  ELSE
    RAISE WARNING '❌ RLS check WOULD FAIL - Check your profile role_id and is_active status';
  END IF;
END $$;

-- Step 5: If your profile is wrong, fix it (replace with your user_id and email)
-- Make yourself a super admin:
/*
UPDATE user_profiles
SET 
  role_id = '00000000-0000-0000-0000-000000000000',  -- Super Admin
  is_active = true
WHERE user_id = 'REPLACE_WITH_YOUR_USER_ID';  -- ⚠️ REPLACE WITH YOUR USER_ID
*/

-- Step 6: Verify user_profiles RLS policies allow reading your own profile
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;

-- Expected: There should be a policy "Users can view their own profile" with:
-- cmd = 'SELECT'
-- qual should include: (auth.uid() = user_id)

