/**
 * Query user_profiles policies directly from database
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

async function queryPolicies() {
  console.log('🔍 Querying user_profiles RLS Policies from Database\n')
  console.log('='.repeat(60))
  
  // Query pg_policies table via a function or direct query
  // Since we can't query pg_policies directly via Supabase JS,
  // we'll create a function to do it
  
  const checkSQL = `
-- Check user_profiles policies
SELECT 
  policyname,
  cmd as command,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_profiles'
ORDER BY policyname;
  `
  
  console.log('📋 Run this SQL in Supabase SQL Editor to see current policies:\n')
  console.log(checkSQL)
  console.log('\n' + '='.repeat(60))
  
  // Also check if RLS is enabled
  const rlsCheckSQL = `
-- Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'user_profiles';
  `
  
  console.log('\n📋 Check if RLS is enabled:\n')
  console.log(rlsCheckSQL)
  console.log('\n' + '='.repeat(60))
  
  // Test: Try to read as anon (should fail if RLS works)
  console.log('\n🧪 Testing RLS with anon key...')
  const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  
  const { data: anonTest, error: anonError } = await anonClient
    .from('user_profiles')
    .select('user_id, role_id')
    .limit(1)
  
  if (anonError) {
    console.log('   ✅ RLS is working (anon key blocked)')
    console.log('   Error:', anonError.message)
    console.log('   Code:', anonError.code)
  } else {
    console.log('   ⚠️  WARNING: RLS might not be working!')
    console.log('   Anon key can read user_profiles')
    console.log('   This means RLS is either disabled or policies are too permissive')
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('\n💡 The fix SQL is ready in:')
  console.log('   supabase/migrations/20251117084000_check_and_fix_user_profiles_policies.sql')
}

queryPolicies().catch(console.error)






