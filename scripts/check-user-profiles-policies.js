/**
 * Check user_profiles RLS policies
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

async function checkPolicies() {
  console.log('🔍 Checking user_profiles RLS Policies\n')
  console.log('='.repeat(60))
  
  // Get all users to test
  const { data: { users } } = await supabase.auth.admin.listUsers()
  console.log(`\nFound ${users?.length || 0} users in auth.users\n`)
  
  // Check if we can read user_profiles with service role (should work)
  console.log('1. Testing service role access to user_profiles...')
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('user_id, name, role_id, is_active')
    .limit(5)
  
  if (profilesError) {
    console.log('   ❌ Error:', profilesError.message)
  } else {
    console.log(`   ✅ Service role can read ${profiles?.length || 0} profiles`)
    if (profiles && profiles.length > 0) {
      console.log('   Sample profiles:')
      profiles.forEach(p => {
        const isAdmin = p.role_id === '00000000-0000-0000-0000-000000000001'
        console.log(`      - ${p.name} (${p.user_id.substring(0, 8)}...): role=${p.role_id.substring(0, 8)}..., admin=${isAdmin}, active=${p.is_active}`)
      })
    }
  }
  
  // Check RLS is enabled
  console.log('\n2. Checking if RLS is enabled on user_profiles...')
  // We can't directly check this via JS, but we can infer from behavior
  
  // Test with anon key (should be blocked if RLS is working)
  const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const { data: anonData, error: anonError } = await anonClient
    .from('user_profiles')
    .select('*')
    .limit(1)
  
  if (anonError) {
    console.log('   ✅ RLS is enabled (anon key blocked)')
    console.log('   Error:', anonError.message)
  } else {
    console.log('   ⚠️  RLS might not be working (anon key can read)')
  }
  
  console.log('\n3. SQL to check policies directly:')
  console.log('   Run this in Supabase SQL Editor:')
  console.log('   ──────────────────────────────────────────')
  console.log(`
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
  `)
  console.log('   ──────────────────────────────────────────')
  
  console.log('\n4. Expected policies on user_profiles:')
  console.log('   ✅ "Users can view their own profile" - SELECT policy')
  console.log('      Should allow: WHERE auth.uid() = user_id')
  console.log('   ✅ "Users can create their own profile" - INSERT policy')
  console.log('      Should allow: WHERE auth.uid() = user_id')
  console.log('   ✅ "Users can update their own profile" - UPDATE policy')
  console.log('      Should allow: WHERE auth.uid() = user_id')
  
  console.log('\n5. The critical issue:')
  console.log('   When departments RLS policy checks user_profiles,')
  console.log('   it needs to be able to read the role_id.')
  console.log('   The "Users can view their own profile" policy should allow this')
  console.log('   because it checks WHERE user_id = auth.uid()')
  console.log('   (the same user checking their own profile)')
  
  console.log('\n' + '='.repeat(60))
}

checkPolicies().catch(console.error)






