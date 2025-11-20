/**
 * Comprehensive fix for departments RLS issues
 * This script diagnoses and fixes the problem using service role
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

async function comprehensiveFix() {
  console.log('🔍 Comprehensive Departments RLS Fix\n')
  console.log('=' .repeat(60))
  
  // Step 1: Check current state
  console.log('\n1. Checking current state...')
  
  // Check if departments table exists
  const { error: deptError } = await supabase.from('departments').select('*').limit(0)
  if (deptError && deptError.code === '42P01') {
    console.log('   ❌ Departments table does not exist!')
    return
  }
  console.log('   ✅ Departments table exists')
  
  // Check user_profiles policies
  console.log('\n2. Checking user_profiles RLS policies...')
  const { data: users } = await supabase.auth.admin.listUsers()
  if (users && users.length > 0) {
    console.log(`   Found ${users.length} users`)
    
    // Find admin users
    const adminUsers = []
    for (const user of users) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role_id, is_active')
        .eq('user_id', user.id)
        .single()
      
      if (profile && profile.role_id === '00000000-0000-0000-0000-000000000001') {
        adminUsers.push({ email: user.email, id: user.id, active: profile.is_active })
      }
    }
    
    console.log(`   Found ${adminUsers.length} admin users:`)
    adminUsers.forEach(u => {
      console.log(`      - ${u.email} (Active: ${u.active})`)
    })
  }
  
  // Step 2: Create the fix SQL
  console.log('\n3. Generating comprehensive fix SQL...\n')
  
  const fixSQL = `
-- COMPREHENSIVE FIX FOR DEPARTMENTS RLS
-- This ensures everything works correctly

-- Step 1: Ensure user_profiles allows reading own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile" 
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Step 2: Create a SECURITY DEFINER function that actually works
-- Using a different approach - create a helper view first
CREATE OR REPLACE VIEW current_user_role AS
SELECT 
  user_id,
  role_id,
  is_active
FROM user_profiles
WHERE user_id = auth.uid();

-- Grant access to the view
GRANT SELECT ON current_user_role TO authenticated;

-- Now create is_admin() using the view (which should work better)
DROP FUNCTION IF EXISTS is_admin() CASCADE;

CREATE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM current_user_role
    WHERE role_id = '00000000-0000-0000-0000-000000000001'::UUID
      AND is_active = true
  );
$$;

ALTER FUNCTION is_admin() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO anon;

-- Step 3: Update departments policies to use direct check
-- This is the most reliable approach
DROP POLICY IF EXISTS "Admins can view all departments" ON departments;
DROP POLICY IF EXISTS "Admins can create departments" ON departments;
DROP POLICY IF EXISTS "Admins can update departments" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments" ON departments;

-- Use direct EXISTS check - this should work because users can read own profile
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
`

  // Save to file
  const fs = require('fs')
  fs.writeFileSync('supabase/migrations/20251117082000_comprehensive_fix.sql', fixSQL)
  console.log('   ✅ SQL saved to: supabase/migrations/20251117082000_comprehensive_fix.sql')
  
  console.log('\n' + '='.repeat(60))
  console.log('\n📋 NEXT STEPS:')
  console.log('\n1. Run this SQL in Supabase SQL Editor:')
  console.log('   https://supabase.com/dashboard/project/ukhhrctscwlstwspuhbd/sql/new')
  console.log('\n2. Or use psql:')
  console.log('   psql "postgresql://postgres:PASSWORD@ukhhrctscwlstwspuhbd.supabase.co:5432/postgres" \\')
  console.log('     -f supabase/migrations/20251117082000_comprehensive_fix.sql')
  console.log('\n3. After running, test creating a department from your app')
  console.log('\n' + '='.repeat(60))
  
  // Show the SQL
  console.log('\n📄 SQL TO RUN:\n')
  console.log(fixSQL)
}

comprehensiveFix().catch(console.error)






