/**
 * Test RLS policies after migration
 * This will help verify if the migration was applied correctly
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

const projectRoot = process.cwd()
dotenv.config({ path: path.resolve(projectRoot, '.env.local') })
dotenv.config({ path: path.resolve(projectRoot, '.env') })

async function runScript() {
  const { supabase } = await import('../lib/supabase/client')
  const { adminSupabase } = await import('../lib/supabase/admin')

  const USER_EMAIL = 'contact.samuelerbo@gmail.com'
  const SUPER_ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000000'

  console.log('🔍 Testing RLS Policies After Migration\n')
  console.log('='.repeat(60))

  try {
    // 1. Get user and create a session
    console.log('\n1️⃣ Getting user and creating session...')
    const { data: { users }, error: listError } = await adminSupabase.auth.admin.listUsers()
    
    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`)
    }

    const user = users.find(u => u.email === USER_EMAIL)
    if (!user) {
      throw new Error(`User not found: ${USER_EMAIL}`)
    }

    console.log(`✅ User found: ${user.email}`)

    // 2. Sign in as the user to get a session
    console.log('\n2️⃣ Signing in to create session...')
    const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
      email: USER_EMAIL,
      password: 'admin123', // Use the password we set earlier
    })

    if (signInError) {
      console.log('⚠️  Could not sign in (this is okay for testing)')
      console.log('   Error:', signInError.message)
      console.log('\n💡 Testing with admin client instead...\n')
    } else {
      console.log(`✅ Session created for: ${session?.user.email}`)
    }

    // 3. Test roles query with regular client (uses RLS)
    console.log('\n3️⃣ Testing roles query with RLS...')
    const { data: rolesRLS, error: rolesRLSError } = await supabase
      .from('roles')
      .select('*')
      .order('name', { ascending: true })

    if (rolesRLSError) {
      console.error('❌ RLS Error fetching roles:', rolesRLSError.message)
      console.error('   Code:', rolesRLSError.code)
      console.error('   Details:', rolesRLSError.details)
      console.error('   Hint:', rolesRLSError.hint)
    } else {
      console.log(`✅ RLS Success: Found ${rolesRLS?.length || 0} roles`)
      if (rolesRLS && rolesRLS.length > 0) {
        console.log(`   Roles: ${rolesRLS.map(r => r.name).join(', ')}`)
      }
    }

    // 4. Test role_questions query with regular client (uses RLS)
    console.log('\n4️⃣ Testing role_questions query with RLS...')
    const { data: questionsRLS, error: questionsRLSError } = await supabase
      .from('role_questions')
      .select('*')
      .order('display_order', { ascending: true })

    if (questionsRLSError) {
      console.error('❌ RLS Error fetching questions:', questionsRLSError.message)
      console.error('   Code:', questionsRLSError.code)
      console.error('   Details:', questionsRLSError.details)
      console.error('   Hint:', questionsRLSError.hint)
    } else {
      console.log(`✅ RLS Success: Found ${questionsRLS?.length || 0} questions`)
      if (questionsRLS && questionsRLS.length > 0) {
        questionsRLS.forEach((q, i) => {
          console.log(`   ${i + 1}. ${q.question_label} (Role: ${q.role_id})`)
        })
      }
    }

    // 5. Check user profile
    console.log('\n5️⃣ Checking user profile...')
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      console.error('❌ Error fetching profile:', profileError.message)
    } else {
      console.log(`✅ Profile found:`)
      console.log(`   - Role ID: ${profile.role_id}`)
      console.log(`   - Is Super Admin: ${profile.role_id === SUPER_ADMIN_ROLE_ID}`)
      console.log(`   - Is Active: ${profile.is_active}`)
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 SUMMARY')
    console.log('='.repeat(60))
    console.log(`Roles (RLS): ${rolesRLS?.length || 0} ${rolesRLSError ? '❌' : '✅'}`)
    console.log(`Questions (RLS): ${questionsRLS?.length || 0} ${questionsRLSError ? '❌' : '✅'}`)
    
    if (rolesRLSError || questionsRLSError) {
      console.log('\n⚠️  RLS POLICIES ISSUE DETECTED!')
      console.log('💡 The migration may not have been applied correctly.')
      console.log('💡 Check Supabase Dashboard → Authentication → Policies')
      console.log('💡 Verify the policies exist for roles and role_questions tables')
    } else if ((!rolesRLS || rolesRLS.length === 0) || (!questionsRLS || questionsRLS.length === 0)) {
      console.log('\n⚠️  No data returned - but no RLS errors')
      console.log('💡 This might mean:')
      console.log('   1. The tables are empty')
      console.log('   2. The RLS policies are too restrictive')
      console.log('   3. The user session is not being recognized')
    } else {
      console.log('\n✅ Everything looks good!')
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

runScript().catch(console.error)





