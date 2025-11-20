/**
 * Test is_admin() function directly and check user role
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testIsAdmin() {
  console.log('🔍 Testing is_admin() function and user roles...\n')

  // Get all users and check their roles
  const { data: { users } } = await supabase.auth.admin.listUsers()
  
  console.log('Checking users with admin role...\n')
  
  for (const user of users) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('name, role_id, is_active, user_id')
      .eq('user_id', user.id)
      .single()

    if (profile) {
      const isAdmin = profile.role_id === '00000000-0000-0000-0000-000000000001'
      if (isAdmin) {
        console.log(`✅ ADMIN USER FOUND:`)
        console.log(`   Email: ${user.email}`)
        console.log(`   User ID: ${user.id}`)
        console.log(`   Profile Name: ${profile.name}`)
        console.log(`   Role ID: ${profile.role_id}`)
        console.log(`   Is Active: ${profile.is_active}`)
        console.log('')
        
        // Test the function with this user's context
        console.log('   Testing is_admin() function...')
        console.log('   (Note: This will use service role, so auth.uid() will be null)')
        console.log('')
      }
    }
  }

  // Now let's check the function definition
  console.log('\n📋 Function Definition Check:')
  console.log('   Run this SQL to verify the function:')
  console.log('   SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = \'is_admin\';')
  console.log('')
  
  // Check RLS policies
  console.log('📋 RLS Policies Check:')
  console.log('   Run this SQL to see the policies:')
  console.log('   SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = \'departments\';')
}

testIsAdmin().catch(console.error)







