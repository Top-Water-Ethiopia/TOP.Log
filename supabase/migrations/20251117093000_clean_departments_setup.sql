-- CLEAN SETUP: Departments table with working RLS policies
-- This is a fresh start - removes all existing departments setup and recreates it properly

-- ============================================================================
-- STEP 1: Clean up existing departments setup
-- ============================================================================

-- Drop existing policies first (to avoid dependency issues)
DROP POLICY IF EXISTS "Users can view active departments" ON departments;
DROP POLICY IF EXISTS "Admins can view all departments" ON departments;
DROP POLICY IF EXISTS "Admins can create departments" ON departments;
DROP POLICY IF EXISTS "Admins can update departments" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments" ON departments;

-- Drop the is_admin() function if it exists
DROP FUNCTION IF EXISTS is_admin() CASCADE;

-- Note: We're NOT dropping the departments table itself
-- If you want to start completely fresh, uncomment the next line:
-- DROP TABLE IF EXISTS departments CASCADE;

-- ============================================================================
-- STEP 2: Create departments table (if it doesn't exist)
-- ============================================================================

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
CREATE INDEX IF NOT EXISTS idx_departments_code ON departments(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments(is_active);
CREATE INDEX IF NOT EXISTS idx_departments_created_by ON departments(created_by);

-- Enable RLS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: Ensure user_profiles policy exists
-- ============================================================================

-- This policy is critical - users must be able to read their own profile
-- for the admin check to work
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile" 
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 4: Create is_admin() function with SECURITY DEFINER
-- ============================================================================

-- This function runs as the postgres user, bypassing RLS
CREATE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id UUID;
  v_result BOOLEAN;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- If no user, return false
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user is admin
  -- This runs as postgres (SECURITY DEFINER), so it bypasses RLS
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_profiles
    WHERE user_id = v_user_id
      AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
      AND is_active = true
  ) INTO v_result;
  
  RETURN COALESCE(v_result, false);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Add comment
COMMENT ON FUNCTION is_admin() IS 'Checks if current user is admin. Uses SECURITY DEFINER to bypass RLS.';

-- ============================================================================
-- STEP 5: Create RLS policies for departments
-- ============================================================================

-- Policy 1: All authenticated users can view active departments
CREATE POLICY "Users can view active departments"
  ON departments FOR SELECT
  USING (is_active = true);

-- Policy 2: Admins can view all departments (including inactive)
CREATE POLICY "Admins can view all departments"
  ON departments FOR SELECT
  USING (is_admin());

-- Policy 3: Admins can create departments
CREATE POLICY "Admins can create departments"
  ON departments FOR INSERT
  WITH CHECK (is_admin());

-- Policy 4: Admins can update departments
CREATE POLICY "Admins can update departments"
  ON departments FOR UPDATE
  USING (is_admin());

-- Policy 5: Admins can delete departments
CREATE POLICY "Admins can delete departments"
  ON departments FOR DELETE
  USING (is_admin());

-- ============================================================================
-- STEP 6: Verification
-- ============================================================================

-- Verify policies were created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'departments';
  
  IF policy_count >= 5 THEN
    RAISE NOTICE '✅ Successfully created % policies for departments', policy_count;
  ELSE
    RAISE WARNING '⚠️  Expected 5 policies, found %', policy_count;
  END IF;
END $$;

-- Verify function exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin') THEN
    RAISE NOTICE '✅ is_admin() function created successfully';
  ELSE
    RAISE WARNING '⚠️  is_admin() function not found';
  END IF;
END $$;

-- ============================================================================
-- STEP 7: Test queries (uncomment to run)
-- ============================================================================

-- Test is_admin() function (should return true for admin users):
-- SELECT is_admin();

-- Check policies:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'departments' ORDER BY policyname;

-- Check user_profiles policies:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'user_profiles' ORDER BY policyname;

-- ============================================================================
-- DONE!
-- ============================================================================

SELECT '✅ Clean departments setup complete!' as status;






