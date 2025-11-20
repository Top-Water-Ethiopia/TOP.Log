/**
 * Test script to debug is_admin() function
 * This script tests various aspects of the is_admin() function to identify why it might return false
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const adminSupabase = supabaseServiceRoleKey 
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000001';

async function testIsAdminFunction() {
  console.log('🔍 Testing is_admin() Function\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Get current user
    console.log('\n📋 Step 1: Checking current authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('⚠️  Not authenticated. Please sign in first.');
      console.log('   You can sign in via the web app or use:');
      console.log('   supabase.auth.signInWithPassword({ email, password })');
      return;
    }

    console.log('✅ Authenticated as:', user.email);
    console.log('   User ID:', user.id);
    console.log('   Created at:', user.created_at);

    // Step 2: Check user profile
    console.log('\n📋 Step 2: Checking user profile...');
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('❌ Error fetching profile:', profileError);
      return;
    }

    if (!profile) {
      console.log('❌ No user profile found!');
      console.log('   This is likely the issue - user profile must exist.');
      return;
    }

    console.log('✅ User profile found:');
    console.log('   Name:', profile.name);
    console.log('   Role ID:', profile.role_id);
    console.log('   Is Active:', profile.is_active);
    console.log('   Department:', profile.department || 'N/A');

    // Step 3: Check role
    console.log('\n📋 Step 3: Checking role...');
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('*')
      .eq('id', profile.role_id)
      .maybeSingle();

    if (roleError) {
      console.error('❌ Error fetching role:', roleError);
    } else if (role) {
      console.log('✅ Role found:');
      console.log('   Role Name:', role.name);
      console.log('   Role ID:', role.id);
      console.log('   Description:', role.description || 'N/A');
    } else {
      console.log('⚠️  Role not found for role_id:', profile.role_id);
    }

    // Step 4: Check if user is admin (by role_id)
    console.log('\n📋 Step 4: Checking admin status...');
    const isAdminByRoleId = profile.role_id === ADMIN_ROLE_ID;
    const isAdminByRoleName = role?.name === 'admin';
    
    console.log('   Admin Role ID:', ADMIN_ROLE_ID);
    console.log('   User Role ID:', profile.role_id);
    console.log('   Match by Role ID:', isAdminByRoleId ? '✅ YES' : '❌ NO');
    console.log('   Match by Role Name:', isAdminByRoleName ? '✅ YES' : '❌ NO');
    
    if (!isAdminByRoleId && !isAdminByRoleName) {
      console.log('\n⚠️  User is NOT an admin based on role_id or role name');
      console.log('   To make this user an admin, update their role_id to:', ADMIN_ROLE_ID);
    }

    // Step 5: Test is_admin() function directly
    console.log('\n📋 Step 5: Testing is_admin() function...');
    const { data: isAdminResult, error: functionError } = await supabase
      .rpc('is_admin');

    if (functionError) {
      console.error('❌ Error calling is_admin():', functionError);
      console.error('   Code:', functionError.code);
      console.error('   Message:', functionError.message);
      console.error('   Details:', functionError.details);
      console.error('   Hint:', functionError.hint);
    } else {
      console.log('   is_admin() result:', isAdminResult);
      console.log('   Expected:', isAdminByRoleId ? 'true' : 'false');
      
      if (isAdminResult === isAdminByRoleId) {
        console.log('   ✅ Function result matches expected value');
      } else {
        console.log('   ❌ Function result does NOT match expected value!');
        console.log('   This indicates a problem with the is_admin() function.');
      }
    }

    // Step 6: Test with raw SQL query (if admin client available)
    if (adminSupabase) {
      console.log('\n📋 Step 6: Testing with admin client (bypassing RLS)...');
      const { data: adminProfile, error: adminError } = await adminSupabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!adminError && adminProfile) {
        console.log('✅ Admin client can see profile:');
        console.log('   Role ID:', adminProfile.role_id);
        console.log('   Is Admin:', adminProfile.role_id === ADMIN_ROLE_ID ? '✅ YES' : '❌ NO');
      }
    }

    // Step 7: Check RLS policies
    console.log('\n📋 Step 7: Checking RLS policies...');
    const { data: policies, error: policiesError } = await supabase
      .rpc('pg_get_policies', { table_name: 'user_profiles' })
      .catch(() => ({ data: null, error: { message: 'Function not available' } }));

    if (policiesError) {
      console.log('   (Cannot check policies directly - this is normal)');
    }

    // Step 8: Summary and recommendations
    console.log('\n📋 Step 8: Summary and Recommendations');
    console.log('='.repeat(60));
    
    const issues = [];
    const recommendations = [];

    if (!profile) {
      issues.push('User profile does not exist');
      recommendations.push('Create a user profile for this user');
    }

    if (profile && profile.role_id !== ADMIN_ROLE_ID) {
      issues.push(`User role_id (${profile.role_id}) does not match admin role_id (${ADMIN_ROLE_ID})`);
      recommendations.push(`Update user profile: UPDATE user_profiles SET role_id = '${ADMIN_ROLE_ID}' WHERE user_id = '${user.id}'`);
    }

    if (profile && !profile.is_active) {
      issues.push('User profile is not active');
      recommendations.push(`Activate user profile: UPDATE user_profiles SET is_active = true WHERE user_id = '${user.id}'`);
    }

    if (functionError) {
      issues.push('is_admin() function has an error');
      recommendations.push('Check the function definition in the database');
    }

    if (isAdminResult !== isAdminByRoleId && !functionError) {
      issues.push('is_admin() function returns incorrect value');
      recommendations.push('The function may have RLS issues or incorrect logic');
    }

    if (issues.length === 0) {
      console.log('✅ No issues found! User should be recognized as admin.');
    } else {
      console.log('❌ Issues found:');
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });

      console.log('\n💡 Recommendations:');
      recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    }

    // Step 9: Provide SQL to fix if needed
    if (profile && profile.role_id !== ADMIN_ROLE_ID) {
      console.log('\n📋 Step 9: SQL to make user admin');
      console.log('='.repeat(60));
      console.log('Run this SQL in your Supabase SQL editor:');
      console.log('\n```sql');
      console.log(`UPDATE user_profiles`);
      console.log(`SET role_id = '${ADMIN_ROLE_ID}'`);
      console.log(`WHERE user_id = '${user.id}';`);
      console.log('```\n');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testIsAdminFunction()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });







