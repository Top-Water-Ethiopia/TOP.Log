-- COMPLETE FIX: Check and fix ALL policies for departments to work
-- This addresses both user_profiles and departments policies

-- ============================================================
-- STEP 1: Check current state
-- ============================================================
-- First, let's see what we have
SELECT 'Current user_profiles policies:' as info;
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_profiles'
ORDER BY policyname;

SELECT 'Current departments policies:' as info;
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'departments'
ORDER BY policyname;

-- ============================================================
-- STEP 2: Fix user_profiles policies
-- ============================================================
-- These policies MUST allow users to read their own profile
-- This is critical for departments policies to work

DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;

-- CRITICAL: Users must be able to read their own profile
-- When departments RLS checks: WHERE user_id = auth.uid()
-- This policy will allow it because it's the same user
CREATE POLICY "Users can view their own profile" 
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- STEP 3: Fix is_admin() function
-- ============================================================
DROP FUNCTION IF EXISTS is_admin() CASCADE;

CREATE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id UUID;
  v_role_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- SECURITY DEFINER runs as postgres = bypasses RLS
  SELECT role_id INTO v_role_id
  FROM user_profiles
  WHERE user_id = v_user_id
    AND is_active = true
  LIMIT 1;
  
  RETURN (v_role_id IS NOT NULL AND v_role_id = '00000000-0000-0000-0000-000000000001'::UUID);
END;
$$;

ALTER FUNCTION is_admin() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO anon;

-- ============================================================
-- STEP 4: Fix departments policies
-- ============================================================
-- Use direct check (most reliable)
DROP POLICY IF EXISTS "Admins can view all departments" ON departments;
DROP POLICY IF EXISTS "Admins can create departments" ON departments;
DROP POLICY IF EXISTS "Admins can update departments" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments" ON departments;

-- Direct role check - this should work because:
-- 1. user_profiles has "Users can view their own profile" policy
-- 2. When checking WHERE user_id = auth.uid(), it's the same user
-- 3. So the policy allows the read
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

-- ============================================================
-- STEP 5: Verify everything
-- ============================================================
SELECT 'Verification - user_profiles policies:' as info;
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'user_profiles' ORDER BY policyname;

SELECT 'Verification - departments policies:' as info;
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'departments' ORDER BY policyname;

SELECT 'Verification - is_admin() function:' as info;
SELECT 
  proname,
  pg_get_userbyid(proowner) as owner,
  CASE WHEN prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END as security
FROM pg_proc
WHERE proname = 'is_admin'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');






