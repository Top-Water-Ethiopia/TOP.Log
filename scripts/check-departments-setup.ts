/**
 * Diagnostic script to check departments table setup and RLS policies
 * Run with: npx tsx scripts/check-departments-setup.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkDatabaseSetup() {
  console.log('🔍 Checking departments table setup...\n')

  try {
    // 1. Check if departments table exists
    console.log('1. Checking if departments table exists...')
    const { data: tableCheck, error: tableError } = await supabase
      .from('departments')
      .select('*')
      .limit(0)

    if (tableError) {
      if (tableError.code === '42P01' || tableError.message.includes('does not exist')) {
        console.log('   ❌ Departments table does not exist')
        console.log('   💡 Run: supabase/migrations/20231116000000_create_departments_table.sql\n')
        return false
      } else {
        console.log('   ⚠️  Error checking table:', tableError.message)
      }
    } else {
      console.log('   ✅ Departments table exists\n')
    }

    // 2. Check if is_admin() function exists
    console.log('2. Checking if is_admin() function exists...')
    const { data: functionCheck, error: functionError } = await supabase.rpc('is_admin')

    if (functionError) {
      if (functionError.code === '42883' || functionError.message.includes('does not exist')) {
        console.log('   ❌ is_admin() function does not exist')
        console.log('   💡 Run: supabase/migrations/20231116000001_fix_departments_rls_policies.sql\n')
        return false
      } else {
        console.log('   ⚠️  Error checking function:', functionError.message)
        console.log('   💡 Note: This might be because you are not authenticated\n')
      }
    } else {
      console.log('   ✅ is_admin() function exists')
      console.log('   📊 Function result:', functionCheck, '\n')
    }

    // 3. Check current user authentication
    console.log('3. Checking authentication...')
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('   ⚠️  Not authenticated')
      console.log('   💡 Please log in first to test admin functionality\n')
      return false
    } else {
      console.log('   ✅ Authenticated as:', user.email)
      console.log('   📋 User ID:', user.id, '\n')
    }

    // 4. Check user profile and role
    console.log('4. Checking user profile and role...')
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, name, role_id, is_active')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      console.log('   ❌ Error fetching profile:', profileError.message)
      console.log('   💡 Make sure user_profiles table exists and has data\n')
      return false
    } else {
      console.log('   ✅ Profile found:')
      console.log('      Name:', profile.name)
      console.log('      Role ID:', profile.role_id)
      console.log('      Is Active:', profile.is_active)
      
      const isAdmin = profile.role_id === '00000000-0000-0000-0000-000000000001'
      if (isAdmin) {
        console.log('      ✅ User has ADMIN role\n')
      } else {
        console.log('      ❌ User does NOT have admin role')
        console.log('      💡 Update role_id to: 00000000-0000-0000-0000-000000000001\n')
        return false
      }
    }

    // 5. Test is_admin() function
    console.log('5. Testing is_admin() function...')
    const { data: adminCheck, error: adminError } = await supabase.rpc('is_admin')

    if (adminError) {
      console.log('   ❌ Error calling is_admin():', adminError.message, '\n')
      return false
    } else {
      console.log('   ✅ is_admin() returned:', adminCheck)
      if (adminCheck) {
        console.log('      ✅ Function correctly identifies you as admin\n')
      } else {
        console.log('      ❌ Function does not identify you as admin')
        console.log('      💡 Check your role_id in user_profiles table\n')
        return false
      }
    }

    // 6. Test SELECT on departments
    console.log('6. Testing SELECT permission on departments...')
    const { data: selectData, error: selectError } = await supabase
      .from('departments')
      .select('*')
      .limit(1)

    if (selectError) {
      console.log('   ❌ SELECT failed:', selectError.message)
      console.log('   💡 Check RLS policies for SELECT\n')
      return false
    } else {
      console.log('   ✅ SELECT permission works')
      console.log('   📊 Found', selectData?.length || 0, 'departments\n')
    }

    // 7. Test INSERT on departments (dry run - will fail but should show proper error)
    console.log('7. Testing INSERT permission on departments...')
    const testDepartment = {
      name: `TEST_${Date.now()}`,
      code: 'TEST',
      description: 'Test department - will be deleted',
      is_active: true,
      created_by: user.id,
      updated_by: user.id,
    }

    const { data: insertData, error: insertError } = await supabase
      .from('departments')
      .insert(testDepartment)
      .select()

    if (insertError) {
      if (insertError.code === '42501') {
        console.log('   ❌ INSERT permission denied (RLS policy blocking)')
        console.log('   💡 Error:', insertError.message)
        console.log('   💡 Make sure is_admin() function is working and RLS policies are correct\n')
        return false
      } else {
        console.log('   ⚠️  INSERT error (might be expected):', insertError.message)
        console.log('   💡 This could be a validation error or duplicate\n')
      }
    } else {
      console.log('   ✅ INSERT permission works!')
      console.log('   📊 Created test department:', insertData?.[0]?.name)
      
      // Clean up test department
      if (insertData?.[0]?.id) {
        const { error: deleteError } = await supabase
          .from('departments')
          .delete()
          .eq('id', insertData[0].id)
        
        if (deleteError) {
          console.log('   ⚠️  Could not delete test department:', deleteError.message)
        } else {
          console.log('   🧹 Cleaned up test department\n')
        }
      }
    }

    console.log('✅ All checks passed! Departments setup is correct.\n')
    return true

  } catch (error: any) {
    console.error('❌ Unexpected error:', error)
    return false
  }
}

// Run the check
checkDatabaseSetup()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })







