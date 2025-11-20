/**
 * Test is_admin() function as if called from the app
 * This simulates what happens when the app calls the function
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Use anon key to simulate app calls
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testAsUser(email, password) {
  console.log(`\n🔍 Testing is_admin() as user: ${email}\n`)

  // Sign in as the user
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password: password || 'test123' // You'll need to provide the actual password
  })

  if (authError) {
    console.log('❌ Auth error:', authError.message)
    return
  }

  if (!authData.user) {
    console.log('❌ No user returned')
    return
  }

  console.log('✅ Authenticated as:', authData.user.email)
  console.log('   User ID:', authData.user.id)

  // Get profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('name, role_id, is_active')
    .eq('user_id', authData.user.id)
    .single()

  if (profile) {
    console.log('📋 Profile:')
    console.log('   Name:', profile.name)
    console.log('   Role ID:', profile.role_id)
    console.log('   Is Active:', profile.is_active)
    console.log('   Is Admin:', profile.role_id === '00000000-0000-0000-0000-000000000001')
  }

  // Test is_admin() function
  console.log('\n🧪 Testing is_admin() function...')
  const { data: isAdminResult, error: rpcError } = await supabase.rpc('is_admin')

  if (rpcError) {
    console.log('❌ RPC Error:', rpcError.message)
    console.log('   Code:', rpcError.code)
    console.log('   Details:', rpcError.details)
  } else {
    console.log('📊 is_admin() result:', isAdminResult)
    console.log('   Expected: true (if user is admin)')
    console.log('   Actual:', isAdminResult)
    
    if (isAdminResult === true) {
      console.log('   ✅ Function works correctly!')
    } else {
      console.log('   ❌ Function returned false (should be true for admin)')
    }
  }

  // Sign out
  await supabase.auth.signOut()
}

// You can test with a specific user
const testEmail = process.argv[2] || 'admin@example.com'
const testPassword = process.argv[3]

if (!testPassword) {
  console.log('Usage: node scripts/test-is-admin-from-app.js <email> <password>')
  console.log('Example: node scripts/test-is-admin-from-app.js admin@example.com password123')
  process.exit(1)
}

testAsUser(testEmail, testPassword).catch(console.error)






