-- Check and fix user_profiles RLS policies
-- This ensures the policies allow role checks from other tables

-- First, let's see what policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_profiles'
ORDER BY policyname;

-- Now, ensure we have the correct policies
-- The key policy is: Users can view their own profile
-- This MUST exist for departments policies to work

-- Drop existing policies to recreate them correctly
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;

-- Recreate the SELECT policy - this is CRITICAL
-- It allows users to read their own profile
-- When departments RLS checks user_profiles with WHERE user_id = auth.uid(),
-- this policy will allow it because it's the same user
CREATE POLICY "Users can view their own profile" 
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to create their own profile
CREATE POLICY "Users can create their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile" 
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Optional: Allow admins to view all profiles (for admin features)
-- This uses the is_admin() function
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role_id = '00000000-0000-0000-0000-000000000001'::UUID
        AND up.is_active = true
    )
  );

-- Verify the policies
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END as has_using
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_profiles'
ORDER BY policyname;






