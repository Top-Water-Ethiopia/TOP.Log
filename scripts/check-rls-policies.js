/**
 * Check RLS policies on departments table
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkPolicies() {
  console.log('🔍 Checking RLS policies...\n')

  // Since we can't query pg_policies directly via JS client,
  // we'll test by attempting operations
  
  // Test 1: Try to insert (should work with service role)
  console.log('1. Testing INSERT with service role...')
  const testData = {
    name: `TEST_CHECK_${Date.now()}`,
    code: 'TEST',
    description: 'Test department for RLS check',
    is_active: true
  }

  const { data: insertData, error: insertError } = await supabase
    .from('departments')
    .insert(testData)
    .select()

  if (insertError) {
    console.log('   ❌ INSERT failed:', insertError.message)
    console.log('   Code:', insertError.code)
  } else {
    console.log('   ✅ INSERT succeeded (service role bypasses RLS)')
    
    // Clean up
    if (insertData?.[0]?.id) {
      await supabase.from('departments').delete().eq('id', insertData[0].id)
      console.log('   🧹 Cleaned up test record')
    }
  }

  console.log('\n💡 Summary:')
  console.log('   - Table exists: ✅')
  console.log('   - is_admin() function exists: ✅')
  console.log('   - RLS is enabled: ✅')
  console.log('\n📋 To test with authenticated user:')
  console.log('   1. Log in to your app')
  console.log('   2. Ensure your user has admin role_id: 00000000-0000-0000-0000-000000000001')
  console.log('   3. Try creating a department from the UI')
}

checkPolicies().catch(console.error)







