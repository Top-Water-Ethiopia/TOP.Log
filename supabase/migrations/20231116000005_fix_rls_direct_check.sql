-- Fix RLS policies by checking role directly instead of using function
-- This approach checks the role_id directly in the policy, which is more reliable

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all departments" ON departments;
DROP POLICY IF EXISTS "Admins can create departments" ON departments;
DROP POLICY IF EXISTS "Admins can update departments" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments" ON departments;

-- Recreate policies using direct role check
-- This checks user_profiles directly in the policy
CREATE POLICY "Admins can view all departments"
  ON departments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
      AND is_active = true
    )
  );

CREATE POLICY "Admins can create departments"
  ON departments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
      AND is_active = true
    )
  );

CREATE POLICY "Admins can update departments"
  ON departments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
      AND is_active = true
    )
  );

CREATE POLICY "Admins can delete departments"
  ON departments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
      AND is_active = true
    )
  );

-- However, this will still be blocked by RLS on user_profiles!
-- We need to ensure user_profiles allows this check
-- Let's add a policy to user_profiles that allows role checking for RLS purposes

-- Add a policy to user_profiles that allows checking own role_id
-- This is needed so RLS policies on other tables can check the role
DROP POLICY IF EXISTS "Users can check their own role for RLS" ON user_profiles;
CREATE POLICY "Users can check their own role for RLS"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- The above policy should already exist, but if it doesn't, this will create it
-- The key is that when checking EXISTS in another table's RLS policy,
-- the user_profiles RLS should allow reading their own record







