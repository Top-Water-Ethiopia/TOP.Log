/**
 * Test is_admin() function and apply fix if needed
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testAndFix() {
  console.log('🔍 Testing is_admin() function...\n')

  // First, let's check a user's actual role
  console.log('1. Checking users and their roles...')
  const { data: { users } } = await supabase.auth.admin.listUsers()
  
  if (users && users.length > 0) {
    console.log(`   Found ${users.length} users\n`)
    
    for (const user of users.slice(0, 5)) { // Check first 5 users
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('name, role_id, is_active')
        .eq('user_id', user.id)
        .single()

      if (profile) {
        const isAdmin = profile.role_id === '00000000-0000-0000-0000-000000000001'
        console.log(`   ${user.email}:`)
        console.log(`      Role ID: ${profile.role_id}`)
        console.log(`      Is Admin: ${isAdmin ? '✅ YES' : '❌ NO'}`)
        console.log(`      Is Active: ${profile.is_active}`)
        console.log('')
      }
    }
  }

  // Now test the function
  console.log('2. Testing is_admin() function via RPC...')
  const { data: funcResult, error: funcError } = await supabase.rpc('is_admin')
  
  if (funcError) {
    console.log('   ❌ Error:', funcError.message)
    console.log('   Code:', funcError.code)
  } else {
    console.log('   Result:', funcResult)
    console.log('   Expected: true (if you are admin)')
  }

  console.log('\n3. Applying fix...')
  console.log('   📄 Run this SQL in Supabase SQL Editor:')
  console.log('   File: supabase/migrations/20231116000003_fix_is_admin_function.sql')
  console.log('')
  console.log('   Or copy this SQL:')
  console.log('   ──────────────────────────────────────────')
  
  const sql = fs.readFileSync('supabase/migrations/20231116000003_fix_is_admin_function.sql', 'utf8')
  console.log(sql)
  
  console.log('   ──────────────────────────────────────────')
}

testAndFix().catch(console.error)







