-- Final fix: Ensure departments policies work correctly
-- The key is that user_profiles RLS must allow the check

-- First, ensure user_profiles has the right policy for RLS checks
-- Users need to be able to read their own profile for the EXISTS check to work
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile" 
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Also allow the check to work from other tables' RLS policies
-- This is critical - when departments RLS checks user_profiles,
-- it needs to be able to read the role_id
-- Since we're checking WHERE user_id = auth.uid(), the above policy should work
-- But let's make sure it's explicit

-- Now update departments policies with direct role check
DROP POLICY IF EXISTS "Admins can view all departments" ON departments;
DROP POLICY IF EXISTS "Admins can create departments" ON departments;
DROP POLICY IF EXISTS "Admins can update departments" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments" ON departments;

-- These policies check user_profiles directly
-- Since users can read their own profile (via the policy above),
-- this EXISTS check should work
CREATE POLICY "Admins can view all departments"
  ON departments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM user_profiles
      WHERE user_id = auth.uid()
        AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
        AND is_active = true
    )
  );

CREATE POLICY "Admins can create departments"
  ON departments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM user_profiles
      WHERE user_id = auth.uid()
        AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
        AND is_active = true
    )
  );

CREATE POLICY "Admins can update departments"
  ON departments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 
      FROM user_profiles
      WHERE user_id = auth.uid()
        AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
        AND is_active = true
    )
  );

CREATE POLICY "Admins can delete departments"
  ON departments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 
      FROM user_profiles
      WHERE user_id = auth.uid()
        AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
        AND is_active = true
    )
  );

-- Note: The is_admin() function will return false in SQL Editor
-- because auth.uid() is null there. But it should work from your app
-- when you're logged in. However, the policies above use direct checks
-- which should work regardless.






