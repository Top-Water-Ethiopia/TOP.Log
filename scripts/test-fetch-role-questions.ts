/**
 * Script to test fetching role questions directly
 * This will help diagnose why questions aren't showing in the UI
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

const projectRoot = process.cwd()
dotenv.config({ path: path.resolve(projectRoot, '.env.local') })
dotenv.config({ path: path.resolve(projectRoot, '.env') })

async function runScript() {
  const { adminSupabase } = await import('../lib/supabase/admin')
  const { supabase } = await import('../lib/supabase/client')

  const SUPER_ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000000'
  const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000001'
  const USER_EMAIL = 'contact.samuelerbo@gmail.com'

  console.log('🔍 Testing Role Questions Fetch\n')
  console.log('='.repeat(60))

  try {
    // 1. Get the user
    console.log('\n1️⃣ Getting user...')
    const { data: { users }, error: listError } = await adminSupabase.auth.admin.listUsers()
    
    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`)
    }

    const user = users.find(u => u.email === USER_EMAIL)
    if (!user) {
      throw new Error(`User not found: ${USER_EMAIL}`)
    }

    console.log(`✅ User found: ${user.email} (${user.id})`)

    // 2. Check user profile
    console.log('\n2️⃣ Checking user profile...')
    const { data: profile, error: profileError } = await adminSupabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      throw new Error(`Failed to get profile: ${profileError.message}`)
    }

    console.log(`✅ Profile found:`)
    console.log(`   - Role ID: ${profile.role_id}`)
    console.log(`   - Name: ${profile.name}`)
    console.log(`   - Is Active: ${profile.is_active}`)

    // 3. Test fetching roles (as admin client - bypasses RLS)
    console.log('\n3️⃣ Fetching roles (admin client - bypasses RLS)...')
    const { data: rolesAdmin, error: rolesAdminError } = await adminSupabase
      .from('roles')
      .select('*')
      .order('name', { ascending: true })

    if (rolesAdminError) {
      console.error(`❌ Error fetching roles (admin): ${rolesAdminError.message}`)
    } else {
      console.log(`✅ Found ${rolesAdmin?.length || 0} roles (admin client)`)
      if (rolesAdmin && rolesAdmin.length > 0) {
        console.log(`   Roles: ${rolesAdmin.map(r => r.name).join(', ')}`)
      }
    }

    // 4. Test fetching roles (as regular client - uses RLS)
    console.log('\n4️⃣ Fetching roles (regular client - uses RLS)...')
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      console.log('⚠️  No active session - cannot test RLS')
    } else {
      console.log(`✅ Active session found for: ${session.user.email}`)
      
      const { data: rolesRLS, error: rolesRLSError } = await supabase
        .from('roles')
        .select('*')
        .order('name', { ascending: true })

      if (rolesRLSError) {
        console.error(`❌ Error fetching roles (RLS): ${rolesRLSError.message}`)
        console.error(`   Code: ${rolesRLSError.code}`)
        console.error(`   Details: ${rolesRLSError.details}`)
        console.error(`   Hint: ${rolesRLSError.hint}`)
      } else {
        console.log(`✅ Found ${rolesRLS?.length || 0} roles (RLS client)`)
        if (rolesRLS && rolesRLS.length > 0) {
          console.log(`   Roles: ${rolesRLS.map(r => r.name).join(', ')}`)
        }
      }
    }

    // 5. Test fetching role_questions (as admin client - bypasses RLS)
    console.log('\n5️⃣ Fetching role_questions (admin client - bypasses RLS)...')
    const { data: questionsAdmin, error: questionsAdminError } = await adminSupabase
      .from('role_questions')
      .select('*')
      .order('display_order', { ascending: true })

    if (questionsAdminError) {
      console.error(`❌ Error fetching questions (admin): ${questionsAdminError.message}`)
    } else {
      console.log(`✅ Found ${questionsAdmin?.length || 0} questions (admin client)`)
      if (questionsAdmin && questionsAdmin.length > 0) {
        questionsAdmin.forEach((q, i) => {
          console.log(`   ${i + 1}. ${q.question_label} (Role: ${q.role_id}, Active: ${q.is_active})`)
        })
      }
    }

    // 6. Test fetching role_questions (as regular client - uses RLS)
    console.log('\n6️⃣ Fetching role_questions (regular client - uses RLS)...')
    if (session) {
      const { data: questionsRLS, error: questionsRLSError } = await supabase
        .from('role_questions')
        .select('*')
        .order('display_order', { ascending: true })

      if (questionsRLSError) {
        console.error(`❌ Error fetching questions (RLS): ${questionsRLSError.message}`)
        console.error(`   Code: ${questionsRLSError.code}`)
        console.error(`   Details: ${questionsRLSError.details}`)
        console.error(`   Hint: ${questionsRLSError.hint}`)
      } else {
        console.log(`✅ Found ${questionsRLS?.length || 0} questions (RLS client)`)
        if (questionsRLS && questionsRLS.length > 0) {
          questionsRLS.forEach((q, i) => {
            console.log(`   ${i + 1}. ${q.question_label} (Role: ${q.role_id}, Active: ${q.is_active})`)
          })
        } else {
          console.log('⚠️  No questions returned - RLS might be blocking')
        }
      }
    }

    // 7. Check RLS policies
    console.log('\n7️⃣ Checking RLS policies...')
    const { data: policies, error: policiesError } = await adminSupabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd,
            qual,
            with_check
          FROM pg_policies
          WHERE tablename = 'role_questions'
          ORDER BY policyname;
        `
      })
      .catch(() => {
        // Try alternative query
        return adminSupabase
          .from('_')
          .select('*')
          .limit(0)
      })

    if (policiesError) {
      console.log('⚠️  Could not check policies directly')
      console.log('💡 Check policies in Supabase Dashboard → Authentication → Policies')
    } else {
      console.log('✅ Policies check completed')
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 SUMMARY')
    console.log('='.repeat(60))
    console.log(`User Role: ${profile.role_id === SUPER_ADMIN_ROLE_ID ? 'Super Admin ✅' : profile.role_id === ADMIN_ROLE_ID ? 'Admin ✅' : 'Other ❌'}`)
    console.log(`Roles (Admin): ${rolesAdmin?.length || 0}`)
    console.log(`Roles (RLS): ${rolesRLS?.length || 0}`)
    console.log(`Questions (Admin): ${questionsAdmin?.length || 0}`)
    console.log(`Questions (RLS): ${questionsRLS?.length || 0}`)
    
    if (questionsAdmin && questionsAdmin.length > 0 && (!questionsRLS || questionsRLS.length === 0)) {
      console.log('\n⚠️  ISSUE DETECTED: Questions exist but RLS is blocking access!')
      console.log('💡 Solution: Apply the RLS migration to fix policies')
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

runScript().catch(console.error)





