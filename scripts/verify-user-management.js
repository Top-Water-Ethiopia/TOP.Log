/**
 * Verify user management setup and test functionality
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

async function verifyUserManagement() {
  console.log('🔍 Verifying User Management Setup\n')
  console.log('='.repeat(60) + '\n')
  
  // Test 1: Check if is_admin() function exists
  console.log('📋 Test 1: Checking is_admin() function...')
  try {
    const { data, error } = await supabase.rpc('is_admin')
    if (error) {
      if (error.code === '42883') {
        console.log('❌ is_admin() function does not exist')
        console.log('   Run the migration: supabase/migrations/20251117094000_fix_user_profiles_policies.sql\n')
      } else {
        console.log(`⚠️  Error calling is_admin(): ${error.message}\n`)
      }
    } else {
      console.log(`✅ is_admin() function exists (returned: ${data})\n`)
    }
  } catch (err) {
    console.log('⚠️  Cannot test is_admin() via RPC (this is expected for service role)\n')
  }
  
  // Test 2: Check user_profiles policies
  console.log('📋 Test 2: Checking user_profiles RLS policies...')
  try {
    // Try to read user_profiles as admin (using service role bypasses RLS)
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(5)
    
    if (error) {
      console.log(`❌ Error reading user_profiles: ${error.message}`)
      console.log(`   Code: ${error.code}`)
      if (error.code === '42501') {
        console.log('   ⚠️  RLS is blocking access - policies may not be set up correctly\n')
      } else {
        console.log(`\n`)
      }
    } else {
      console.log(`✅ Successfully read ${profiles?.length || 0} user profiles`)
      console.log('   (Service role bypasses RLS, so this confirms table exists)\n')
    }
  } catch (err) {
    console.log(`❌ Error: ${err.message}\n`)
  }
  
  // Test 3: Check admin users
  console.log('📋 Test 3: Finding admin users...')
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
  } else {
    console.log(`✅ Found ${adminUsers.length} admin user(s):`)
    adminUsers.forEach(({ user, profile }) => {
      console.log(`   - ${user.email} (${profile.name})`)
    })
    console.log('')
  }
  
  // Test 4: Check roles
  console.log('📋 Test 4: Checking roles...')
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
  
  // Test 5: Verify user_profiles access
  let profilesAccessible = false
  try {
    const { data: testProfiles } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1)
    profilesAccessible = !!testProfiles
  } catch (err) {
    profilesAccessible = false
  }
  
  // Summary
  console.log('='.repeat(60))
  console.log('\n📋 Summary:')
  console.log(`   ${adminUsers.length > 0 ? '✅' : '❌'} Admin users: ${adminUsers.length}`)
  console.log(`   ${roles && roles.length > 0 ? '✅' : '❌'} Roles: ${roles?.length || 0}`)
  console.log(`   ${profilesAccessible ? '✅' : '❌'} user_profiles table accessible`)
  
  console.log('\n📋 Next Steps:')
  if (adminUsers.length === 0) {
    console.log('   1. Create an admin user')
  } else {
    console.log('   1. ✅ Admin users exist')
  }
  console.log('   2. Test user management in app: http://localhost:3001/admin/users')
  console.log('   3. Try creating, updating, and managing users')
  console.log('   4. Once user management works, test departments')
  
  console.log('\n💡 If user management doesn\'t work:')
  console.log('   - Verify migration was run: supabase/migrations/20251117094000_fix_user_profiles_policies.sql')
  console.log('   - Check browser console for errors')
  console.log('   - Verify you are logged in as admin')
}

verifyUserManagement().catch(console.error)

