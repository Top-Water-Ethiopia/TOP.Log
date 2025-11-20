/**
 * Diagnose why admin cannot create departments
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function diagnose() {
  console.log('🔍 Diagnosing admin department creation issue\n')
  
  // Get all users with their profiles
  const { data: { users } } = await supabase.auth.admin.listUsers()
  
  console.log(`Found ${users.length} users\n`)
  
  for (const user of users || []) {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (profileError) {
      console.log(`❌ User ${user.email}: No profile found`)
      continue
    }
    
    const isAdmin = profile.role_id === '00000000-0000-0000-0000-000000000001' && profile.is_active
    
    console.log(`👤 User: ${user.email}`)
    console.log(`   ID: ${user.id}`)
    console.log(`   Role ID: ${profile.role_id}`)
    console.log(`   Is Active: ${profile.is_active}`)
    console.log(`   Is Admin: ${isAdmin ? '✅ YES' : '❌ NO'}`)
    console.log('')
  }
  
  // Check policies
  console.log('\n📋 Checking policies...\n')
  
  const { data: userProfilesPolicies, error: upError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT policyname, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename = 'user_profiles'
      ORDER BY policyname;
    `
  }).catch(() => ({ data: null, error: { message: 'Cannot check policies via RPC' } }))
  
  if (upError) {
    console.log('⚠️  Cannot check policies via API (this is expected)')
    console.log('   You need to check policies in Supabase SQL Editor\n')
  }
  
  // Generate fix SQL
  const fixSQL = `
-- ULTIMATE FIX: Make is_admin() work and fix policies
-- This uses a different approach - bypass RLS completely in the function

-- Step 1: Drop and recreate is_admin() with explicit RLS bypass
DROP FUNCTION IF EXISTS is_admin() CASCADE;

CREATE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();
  
  -- If no user, return false
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check admin status - this runs as postgres, bypassing RLS
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_profiles
    WHERE user_id = v_user_id
      AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
      AND is_active = true
  ) INTO v_is_admin;
  
  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Step 2: Ensure user_profiles policy exists
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile" 
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Step 3: Fix departments policies - use ONLY is_admin() function
-- The function bypasses RLS, so it will work
DROP POLICY IF EXISTS "Users can view active departments" ON departments;
DROP POLICY IF EXISTS "Admins can view all departments" ON departments;
DROP POLICY IF EXISTS "Admins can create departments" ON departments;
DROP POLICY IF EXISTS "Admins can update departments" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments" ON departments;

-- Regular users can view active departments
CREATE POLICY "Users can view active departments"
  ON departments FOR SELECT
  USING (is_active = true);

-- Admins can view all departments
CREATE POLICY "Admins can view all departments"
  ON departments FOR SELECT
  USING (is_admin());

-- CRITICAL: Admins can create departments
CREATE POLICY "Admins can create departments"
  ON departments FOR INSERT
  WITH CHECK (is_admin());

-- Admins can update departments
CREATE POLICY "Admins can update departments"
  ON departments FOR UPDATE
  USING (is_admin());

-- Admins can delete departments
CREATE POLICY "Admins can delete departments"
  ON departments FOR DELETE
  USING (is_admin());

-- Verify
SELECT 'Setup complete!' as status;
  `
  
  const fs = require('fs')
  fs.writeFileSync('supabase/migrations/20251117092000_final_admin_fix.sql', fixSQL)
  
  console.log('✅ Created fix: supabase/migrations/20251117092000_final_admin_fix.sql')
  console.log('\n📋 This fix:')
  console.log('  1. Recreates is_admin() with explicit RLS bypass')
  console.log('  2. Uses ONLY is_admin() in policies (no EXISTS subquery)')
  console.log('  3. The function runs as postgres, so it bypasses RLS')
  console.log('  4. This should work even if direct checks fail')
  console.log('\n' + '='.repeat(60))
  console.log('\nSQL TO RUN:\n')
  console.log(fixSQL)
}

diagnose().catch(console.error)






