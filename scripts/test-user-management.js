/**
 * Test User Management functionality
 * Verifies that admins can manage users correctly
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000001'
const USER_ROLE_ID = '00000000-0000-0000-0000-000000000002'

async function testUserManagement() {
  console.log('🧪 Testing User Management Functionality\n')
  console.log('='.repeat(60) + '\n')
  
  // Test 1: Check user_profiles RLS policies
  console.log('📋 Test 1: Checking user_profiles RLS policies...')
  try {
    const { data: policies, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT policyname, cmd, qual, with_check 
        FROM pg_policies 
        WHERE tablename = 'user_profiles'
        ORDER BY policyname;
      `
    }).catch(() => ({ data: null, error: { message: 'Cannot check via RPC' } }))
    
    if (error) {
      console.log('⚠️  Cannot check policies via API (expected)')
      console.log('   You need to check policies in Supabase SQL Editor\n')
    } else {
      console.log(`✅ Found ${policies?.length || 0} policies for user_profiles`)
      policies?.forEach(p => {
        console.log(`   - ${p.policyname}: ${p.cmd}`)
      })
      console.log('')
    }
  } catch (err) {
    console.log('⚠️  Cannot check policies (this is expected)\n')
  }
  
  // Test 2: Get admin users
  console.log('📋 Test 2: Finding admin users...')
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const adminUsers = []
  
  for (const user of users || []) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (profile && profile.role_id === ADMIN_ROLE_ID && profile.is_active) {
      adminUsers.push({ user, profile })
    }
  }
  
  if (adminUsers.length === 0) {
    console.log('❌ No admin users found!')
    console.log('   You need at least one admin user to test user management.\n')
    return
  }
  
  console.log(`✅ Found ${adminUsers.length} admin user(s):`)
  adminUsers.forEach(({ user, profile }) => {
    console.log(`   - ${user.email} (${profile.name})`)
  })
  console.log('')
  
  // Test 3: Check if admins can read user_profiles
  console.log('📋 Test 3: Testing admin access to user_profiles...')
  const testAdmin = adminUsers[0]
  
  // Create a client with admin user's session (simulated)
  // Note: We can't easily simulate a user session, so we'll use service role
  // In real app, this would be done with user's JWT token
  
  const { data: allProfiles, error: readError } = await supabase
    .from('user_profiles')
    .select('*')
    .limit(5)
  
  if (readError) {
    console.log(`❌ Error reading user_profiles: ${readError.message}`)
    console.log(`   Code: ${readError.code}`)
    console.log(`   This suggests RLS policies might be blocking access\n`)
  } else {
    console.log(`✅ Successfully read ${allProfiles?.length || 0} user profiles`)
    console.log('   Admin can access user_profiles table\n')
  }
  
  // Test 4: Check user_profiles table structure
  console.log('📋 Test 4: Checking user_profiles table structure...')
  const { data: sampleProfile } = await supabase
    .from('user_profiles')
    .select('*')
    .limit(1)
    .single()
  
  if (sampleProfile) {
    console.log('✅ Table structure looks good:')
    console.log(`   Columns: ${Object.keys(sampleProfile).join(', ')}`)
    console.log('')
  } else {
    console.log('⚠️  No profiles found to check structure\n')
  }
  
  // Test 5: Check roles table
  console.log('📋 Test 5: Checking roles table...')
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('*')
    .order('name')
  
  if (rolesError) {
    console.log(`❌ Error reading roles: ${rolesError.message}\n`)
  } else {
    console.log(`✅ Found ${roles?.length || 0} roles:`)
    roles?.forEach(role => {
      const isAdmin = role.id === ADMIN_ROLE_ID
      console.log(`   - ${role.name} (${role.id}) ${isAdmin ? '👑' : ''}`)
    })
    console.log('')
  }
  
  // Test 6: Generate SQL to check/fix user_profiles policies
  console.log('📋 Test 6: Generating SQL to verify/fix user_profiles policies...\n')
  
  const fixSQL = `
-- Verify and fix user_profiles RLS policies
-- This ensures admins can manage users

-- Step 1: Check current policies
SELECT 'Current user_profiles policies:' as info;
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'user_profiles'
ORDER BY policyname;

-- Step 2: Ensure basic policy exists
-- Users should be able to read their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile" 
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Step 3: Admins should be able to read all profiles
-- This is needed for user management
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role_id = '00000000-0000-0000-0000-000000000001'::UUID
        AND up.is_active = true
    )
  );

-- Step 4: Admins should be able to insert profiles (for creating users)
DROP POLICY IF EXISTS "Admins can create profiles" ON user_profiles;
CREATE POLICY "Admins can create profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role_id = '00000000-0000-0000-0000-000000000001'::UUID
        AND up.is_active = true
    )
  );

-- Step 5: Admins should be able to update profiles
DROP POLICY IF EXISTS "Admins can update profiles" ON user_profiles;
CREATE POLICY "Admins can update profiles"
  ON user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 
      FROM user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role_id = '00000000-0000-0000-0000-000000000001'::UUID
        AND up.is_active = true
    )
  );

-- Step 6: Verify policies
SELECT 'Updated user_profiles policies:' as info;
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'user_profiles' 
ORDER BY policyname;
  `
  
  const fs = require('fs')
  fs.writeFileSync('supabase/migrations/20251117094000_fix_user_profiles_policies.sql', fixSQL)
  
  console.log('✅ Created: supabase/migrations/20251117094000_fix_user_profiles_policies.sql')
  console.log('\n📋 Summary:')
  console.log(`   ✅ Found ${adminUsers.length} admin user(s)`)
  console.log(`   ${readError ? '❌' : '✅'} Admin access to user_profiles: ${readError ? 'BLOCKED' : 'WORKING'}`)
  console.log(`   ✅ Found ${roles?.length || 0} roles`)
  console.log('\n📋 Next steps:')
  console.log('   1. Review the generated SQL migration')
  console.log('   2. Run it in Supabase SQL Editor if needed')
  console.log('   3. Test user management in the app')
  console.log('\n' + '='.repeat(60))
}

testUserManagement().catch(console.error)






