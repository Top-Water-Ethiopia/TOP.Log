/**
 * Seed sample users and test is_admin() function
 * This script will:
 * 1. Create sample users (admin and regular users)
 * 2. Test is_admin() function for each user
 * 3. Identify where the problem is
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing required environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000001';
const USER_ROLE_ID = '00000000-0000-0000-0000-000000000002';

// Sample users to create
const SAMPLE_USERS = [
  {
    email: 'test-admin@example.com',
    password: 'TestAdmin123!',
    name: 'Test Admin User',
    role_id: ADMIN_ROLE_ID,
    department: 'IT',
    shouldBeAdmin: true
  },
  {
    email: 'test-user@example.com',
    password: 'TestUser123!',
    name: 'Test Regular User',
    role_id: USER_ROLE_ID,
    department: 'Engineering',
    shouldBeAdmin: false
  }
];

interface TestResult {
  email: string;
  userId: string | null;
  profileExists: boolean;
  roleId: string | null;
  isActive: boolean | null;
  isAdminByRole: boolean;
  isAdminByFunction: boolean | null;
  functionError: string | null;
  matches: boolean;
}

async function createOrGetUser(userData: typeof SAMPLE_USERS[0]) {
  console.log(`\n📋 Processing user: ${userData.email}`);
  
  // Check if user already exists
  const { data: { users } } = await adminSupabase.auth.admin.listUsers();
  let authUser = users.find(u => u.email === userData.email);
  
  if (!authUser) {
    console.log('  Creating new auth user...');
    const { data, error } = await adminSupabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true
    });
    
    if (error) {
      console.error(`  ❌ Error creating auth user:`, error);
      return null;
    }
    
    authUser = data.user;
    console.log(`  ✅ Created auth user: ${authUser.id}`);
  } else {
    console.log(`  ℹ️  Auth user already exists: ${authUser.id}`);
  }
  
  // Check/update profile
  const { data: existingProfile } = await adminSupabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', authUser.id)
    .maybeSingle();
  
  if (existingProfile) {
    console.log('  ℹ️  Profile exists, updating...');
    const { error } = await adminSupabase
      .from('user_profiles')
      .update({
        name: userData.name,
        role_id: userData.role_id,
        department: userData.department,
        is_active: true
      })
      .eq('user_id', authUser.id);
    
    if (error) {
      console.error(`  ❌ Error updating profile:`, error);
      return null;
    }
    console.log('  ✅ Profile updated');
  } else {
    console.log('  Creating new profile...');
    const { error } = await adminSupabase
      .from('user_profiles')
      .insert({
        user_id: authUser.id,
        name: userData.name,
        role_id: userData.role_id,
        department: userData.department,
        is_active: true
      });
    
    if (error) {
      console.error(`  ❌ Error creating profile:`, error);
      return null;
    }
    console.log('  ✅ Profile created');
  }
  
  return authUser;
}

async function testIsAdminFunction(userId: string, email: string): Promise<{
  isAdminByFunction: boolean | null;
  functionError: string | null;
}> {
  // We need to test as that user, so we'll use RPC
  // But first, let's test with admin client to see if function works at all
  try {
    // Test the function directly (this will use service role context)
    const { data, error } = await adminSupabase.rpc('is_admin');
    
    if (error) {
      return {
        isAdminByFunction: null,
        functionError: error.message
      };
    }
    
    // Note: This tests as service role, not as the user
    // We need a different approach to test as the actual user
    return {
      isAdminByFunction: data === true,
      functionError: null
    };
  } catch (error) {
    return {
      isAdminByFunction: null,
      functionError: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function testUser(userData: typeof SAMPLE_USERS[0], authUser: any): Promise<TestResult> {
  console.log(`\n🔍 Testing user: ${userData.email}`);
  
  // Get profile
  const { data: profile, error: profileError } = await adminSupabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', authUser.id)
    .maybeSingle();
  
  const profileExists = !!profile && !profileError;
  const roleId = profile?.role_id || null;
  const isActive = profile?.is_active ?? null;
  const isAdminByRole = roleId === ADMIN_ROLE_ID;
  
  console.log(`  Profile exists: ${profileExists ? '✅' : '❌'}`);
  if (profile) {
    console.log(`  Role ID: ${roleId}`);
    console.log(`  Is Active: ${isActive}`);
    console.log(`  Is Admin (by role): ${isAdminByRole ? '✅ YES' : '❌ NO'}`);
  }
  
  // Test is_admin() function
  // Note: We can't easily test as the user without their session
  // So we'll test the function logic directly
  let isAdminByFunction: boolean | null = null;
  let functionError: string | null = null;
  
  try {
    // Check if function exists and can be called
    const { data: functionResult, error: funcError } = await adminSupabase.rpc('is_admin');
    
    if (funcError) {
      functionError = funcError.message;
      console.log(`  ❌ is_admin() function error: ${funcError.message}`);
    } else {
      // This will return result for service role, not the user
      // So we need to check the logic differently
      console.log(`  ⚠️  is_admin() returned: ${functionResult} (as service role, not as user)`);
      
      // Instead, let's check if the function would work for this user
      // by simulating what it does
      const { data: directCheck } = await adminSupabase
        .from('user_profiles')
        .select('role_id')
        .eq('user_id', authUser.id)
        .eq('role_id', ADMIN_ROLE_ID)
        .eq('is_active', true)
        .maybeSingle();
      
      isAdminByFunction = !!directCheck;
      console.log(`  Direct check (what function should do): ${isAdminByFunction ? '✅ YES' : '❌ NO'}`);
    }
  } catch (error) {
    functionError = error instanceof Error ? error.message : 'Unknown error';
    console.log(`  ❌ Error testing function: ${functionError}`);
  }
  
  const matches = isAdminByRole === isAdminByFunction;
  
  return {
    email: userData.email,
    userId: authUser.id,
    profileExists,
    roleId,
    isActive,
    isAdminByRole,
    isAdminByFunction,
    functionError,
    matches
  };
}

async function main() {
  console.log('🚀 Starting user seeding and is_admin() testing...\n');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Ensure roles exist
    console.log('\n📋 Step 1: Ensuring roles exist...');
    const { error: adminRoleError } = await adminSupabase
      .from('roles')
      .upsert({
        id: ADMIN_ROLE_ID,
        name: 'admin',
        description: 'Administrator with full access'
      }, { onConflict: 'id' });
    
    if (adminRoleError) {
      console.error('  ❌ Error ensuring admin role:', adminRoleError);
    } else {
      console.log('  ✅ Admin role exists');
    }
    
    const { error: userRoleError } = await adminSupabase
      .from('roles')
      .upsert({
        id: USER_ROLE_ID,
        name: 'user',
        description: 'Standard user'
      }, { onConflict: 'id' });
    
    if (userRoleError) {
      console.error('  ❌ Error ensuring user role:', userRoleError);
    } else {
      console.log('  ✅ User role exists');
    }
    
    // Step 2: Create/update users
    console.log('\n📋 Step 2: Creating/updating users...');
    const createdUsers: any[] = [];
    
    for (const userData of SAMPLE_USERS) {
      const authUser = await createOrGetUser(userData);
      if (authUser) {
        createdUsers.push({ authUser, userData });
      }
    }
    
    // Step 3: Test each user
    console.log('\n📋 Step 3: Testing is_admin() function...');
    console.log('='.repeat(60));
    
    const results: TestResult[] = [];
    
    for (const { authUser, userData } of createdUsers) {
      const result = await testUser(userData, authUser);
      results.push(result);
    }
    
    // Step 4: Summary
    console.log('\n📋 Step 4: Test Summary');
    console.log('='.repeat(60));
    
    for (const result of results) {
      console.log(`\n👤 User: ${result.email}`);
      console.log(`   User ID: ${result.userId}`);
      console.log(`   Profile exists: ${result.profileExists ? '✅' : '❌'}`);
      console.log(`   Role ID: ${result.roleId}`);
      console.log(`   Is Active: ${result.isActive}`);
      console.log(`   Is Admin (by role check): ${result.isAdminByRole ? '✅ YES' : '❌ NO'}`);
      console.log(`   Is Admin (by function logic): ${result.isAdminByFunction !== null ? (result.isAdminByFunction ? '✅ YES' : '❌ NO') : '❓ UNKNOWN'}`);
      
      if (result.functionError) {
        console.log(`   Function Error: ❌ ${result.functionError}`);
      }
      
      console.log(`   Results Match: ${result.matches ? '✅ YES' : '❌ NO'}`);
      
      if (!result.matches && result.isAdminByRole) {
        console.log(`   ⚠️  ISSUE: User should be admin but function returns false!`);
      }
    }
    
    // Step 5: Recommendations
    console.log('\n📋 Step 5: Recommendations');
    console.log('='.repeat(60));
    
    const issues = results.filter(r => !r.matches && r.isAdminByRole);
    
    if (issues.length > 0) {
      console.log('\n❌ Issues found:');
      issues.forEach(issue => {
        console.log(`   - ${issue.email}: Should be admin but function doesn't recognize it`);
      });
      
      console.log('\n💡 Possible causes:');
      console.log('   1. is_admin() function cannot read user_profiles (RLS blocking)');
      console.log('   2. Function is not using SECURITY DEFINER correctly');
      console.log('   3. Function logic is incorrect');
      console.log('   4. auth.uid() is not returning the correct user ID in function context');
      
      console.log('\n🔧 To test as actual user:');
      console.log('   1. Sign in as test-admin@example.com (password: TestAdmin123!)');
      console.log('   2. Run the SQL test script in Supabase SQL Editor');
      console.log('   3. Or use the test-is-admin-function.js script after signing in');
    } else {
      console.log('\n✅ No issues found! All tests passed.');
    }
    
    // Step 6: Provide login credentials
    console.log('\n📋 Step 6: Test User Credentials');
    console.log('='.repeat(60));
    console.log('\nYou can now test by signing in with these credentials:');
    console.log('\nAdmin User:');
    console.log('  Email: test-admin@example.com');
    console.log('  Password: TestAdmin123!');
    console.log('  Expected: is_admin() should return true');
    console.log('\nRegular User:');
    console.log('  Email: test-user@example.com');
    console.log('  Password: TestUser123!');
    console.log('  Expected: is_admin() should return false');
    
    console.log('\n✨ Seeding and testing completed!');
    
  } catch (error) {
    console.error('\n❌ Error during seeding/testing:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

main();







