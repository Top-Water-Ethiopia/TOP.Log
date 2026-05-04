/**
 * Check if a specific user has admin role
 * Usage: node scripts/check-user-admin-status.js [user-email]
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkUserAdminStatus(email) {
  console.log('🔍 Checking user admin status...\n')

  if (!email) {
    console.log('❌ Please provide a user email')
    console.log('   Usage: node scripts/check-user-admin-status.js user@example.com')
    process.exit(1)
  }

  // Get user by email
  const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()
  
  if (userError) {
    console.error('❌ Error fetching users:', userError.message)
    process.exit(1)
  }

  const user = users.find(u => u.email === email)
  
  if (!user) {
    console.log(`❌ User not found: ${email}`)
    process.exit(1)
  }

  console.log(`✅ Found user: ${user.email}`)
  console.log(`   User ID: ${user.id}\n`)

  // Check profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, name, role_id, is_active')
    .eq('user_id', user.id)
    .single()

  if (profileError) {
    console.log('❌ Error fetching profile:', profileError.message)
    console.log('💡 User profile might not exist. Creating one...')
    
    // Try to create profile
    const { data: newProfile, error: createError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: user.id,
        name: user.email?.split('@')[0] || 'User',
        role_id: '00000000-0000-0000-0000-000000000001', // Admin role
        is_active: true
      })
      .select()
      .single()

    if (createError) {
      console.log('❌ Could not create profile:', createError.message)
      process.exit(1)
    } else {
      console.log('✅ Created profile with admin role')
      return
    }
  }

  console.log('📋 Profile:')
  console.log(`   Name: ${profile.name}`)
  console.log(`   Role ID: ${profile.role_id}`)
  console.log(`   Is Active: ${profile.is_active}`)

  const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000001'
  const isAdmin = profile.role_id === ADMIN_ROLE_ID

  if (isAdmin) {
    console.log('\n✅ User HAS admin role')
  } else {
    console.log('\n❌ User does NOT have admin role')
    console.log('💡 To fix, run this SQL in Supabase SQL Editor:')
    console.log(`   UPDATE user_profiles`)
    console.log(`   SET role_id = '${ADMIN_ROLE_ID}'`)
    console.log(`   WHERE user_id = '${user.id}';`)
  }
}

const email = process.argv[2]
checkUserAdminStatus(email).catch(console.error)







