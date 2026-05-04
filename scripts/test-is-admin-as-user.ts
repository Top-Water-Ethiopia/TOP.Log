/**
 * Test is_admin() function by authenticating as each test user
 * This will properly test the function in the user's context
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);
const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000001';

const TEST_USERS = [
  {
    email: 'test-admin@example.com',
    password: 'TestAdmin123!',
    expectedAdmin: true
  },
  {
    email: 'test-user@example.com',
    password: 'TestUser123!',
    expectedAdmin: false
  }
];

async function testAsUser(email: string, password: string, expectedAdmin: boolean) {
  console.log(`\n🔍 Testing as user: ${email}`);
  console.log('='.repeat(60));
  
  // Create a client for this user
  const userSupabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // Sign in as the user
  console.log('  Signing in...');
  const { data: authData, error: signInError } = await userSupabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (signInError || !authData.user) {
    console.error(`  ❌ Failed to sign in: ${signInError?.message}`);
    return;
  }
  
  console.log(`  ✅ Signed in as: ${authData.user.id}`);
  
  // Get user profile
  console.log('  Fetching user profile...');
  const { data: profile, error: profileError } = await userSupabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  
  if (profileError) {
    console.error(`  ❌ Error fetching profile: ${profileError.message}`);
    return;
  }
  
  if (!profile) {
    console.error(`  ❌ Profile not found!`);
    return;
  }
  
  console.log(`  ✅ Profile found:`);
  console.log(`     Name: ${profile.name}`);
  console.log(`     Role ID: ${profile.role_id}`);
  console.log(`     Is Active: ${profile.is_active}`);
  
  const isAdminByRole = profile.role_id === ADMIN_ROLE_ID;
  console.log(`     Is Admin (by role): ${isAdminByRole ? '✅ YES' : '❌ NO'}`);
  
  // Test is_admin() function
  console.log('  Testing is_admin() function...');
  const { data: isAdminResult, error: functionError } = await userSupabase.rpc('is_admin');
  
  if (functionError) {
    console.error(`  ❌ Function error: ${functionError.message}`);
    console.error(`     Code: ${functionError.code}`);
    console.error(`     Details: ${functionError.details}`);
    console.error(`     Hint: ${functionError.hint}`);
    return;
  }
  
  console.log(`  ✅ is_admin() returned: ${isAdminResult}`);
  console.log(`     Expected: ${expectedAdmin}`);
  
  const matches = isAdminResult === expectedAdmin;
  const roleMatches = isAdminByRole === expectedAdmin;
  
  console.log(`\n  📊 Results:`);
  console.log(`     Role check matches expected: ${roleMatches ? '✅ YES' : '❌ NO'}`);
  console.log(`     Function result matches expected: ${matches ? '✅ YES' : '❌ NO'}`);
  console.log(`     Function result matches role check: ${isAdminResult === isAdminByRole ? '✅ YES' : '❌ NO'}`);
  
  if (!matches) {
    console.log(`\n  ❌ PROBLEM FOUND!`);
    if (isAdminByRole && !isAdminResult) {
      console.log(`     User has admin role but is_admin() returns false!`);
      console.log(`     This indicates the function cannot properly check the user's role.`);
    } else if (!isAdminByRole && isAdminResult) {
      console.log(`     User does NOT have admin role but is_admin() returns true!`);
      console.log(`     This indicates the function has incorrect logic.`);
    }
  } else {
    console.log(`\n  ✅ Test passed!`);
  }
  
  // Sign out
  await userSupabase.auth.signOut();
}

async function main() {
  console.log('🚀 Testing is_admin() function as actual users...\n');
  
  for (const user of TEST_USERS) {
    await testAsUser(user.email, user.password, user.expectedAdmin);
  }
  
  console.log('\n✨ Testing completed!');
  console.log('\n💡 Next steps:');
  console.log('   1. If is_admin() returns false for admin users, check:');
  console.log('      - Function definition (SECURITY DEFINER, search_path)');
  console.log('      - RLS policies on user_profiles table');
  console.log('      - Function permissions (GRANT EXECUTE)');
  console.log('   2. Run the SQL test script in Supabase SQL Editor while logged in');
  console.log('   3. Check the function logs for any errors');
}

main().catch(console.error);







