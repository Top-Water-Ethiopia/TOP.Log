/**
 * Check your account status and identify why is_admin() might return false
 * This script will check your account's role, profile, and test the is_admin() function
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000001';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function checkUserByEmail(email: string) {
  console.log(`\n🔍 Checking account: ${email}\n`);
  console.log('='.repeat(60));
  
  // Step 1: Find user in auth.users
  console.log('\n📋 Step 1: Finding user in auth.users...');
  const { data: { users }, error: listError } = await adminSupabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('❌ Error listing users:', listError.message);
    return;
  }
  
  const authUser = users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
  
  if (!authUser) {
    console.log(`❌ User not found: ${email}`);
    console.log('\n💡 Available users:');
    users.slice(0, 10).forEach(u => {
      console.log(`   - ${u.email}`);
    });
    if (users.length > 10) {
      console.log(`   ... and ${users.length - 10} more`);
    }
    return;
  }
  
  console.log(`✅ Found user:`);
  console.log(`   User ID: ${authUser.id}`);
  console.log(`   Email: ${authUser.email}`);
  console.log(`   Created: ${authUser.created_at}`);
  console.log(`   Last Sign In: ${authUser.last_sign_in_at || 'Never'}`);
  
  // Step 2: Check user profile
  console.log('\n📋 Step 2: Checking user profile...');
  const { data: profile, error: profileError } = await adminSupabase
    .from('user_profiles')
    .select(`
      *,
      roles:role_id (
        id,
        name,
        description
      )
    `)
    .eq('user_id', authUser.id)
    .maybeSingle();
  
  if (profileError) {
    console.error(`❌ Error fetching profile: ${profileError.message}`);
    return;
  }
  
  if (!profile) {
    console.log('❌ User profile does NOT exist!');
    console.log('\n💡 This is likely the problem. Creating profile...');
    
    const { error: createError } = await adminSupabase
      .from('user_profiles')
      .insert({
        user_id: authUser.id,
        name: authUser.email?.split('@')[0] || 'User',
        role_id: ADMIN_ROLE_ID, // Create as admin
        is_active: true
      });
    
    if (createError) {
      console.error(`❌ Error creating profile: ${createError.message}`);
      return;
    }
    
    console.log('✅ Profile created with admin role!');
    console.log('   Please run this script again to verify.');
    return;
  }
  
  console.log(`✅ Profile found:`);
  console.log(`   Name: ${profile.name}`);
  console.log(`   Department: ${profile.department || 'N/A'}`);
  console.log(`   Role ID: ${profile.role_id}`);
  console.log(`   Role Name: ${(profile.roles as any)?.name || 'N/A'}`);
  console.log(`   Is Active: ${profile.is_active}`);
  console.log(`   Created: ${profile.created_at}`);
  console.log(`   Last Login: ${profile.last_login || 'Never'}`);
  
  // Step 3: Check if user is admin
  console.log('\n📋 Step 3: Checking admin status...');
  const isAdminByRole = profile.role_id === ADMIN_ROLE_ID;
  const isActive = profile.is_active === true;
  
  console.log(`   Admin Role ID: ${ADMIN_ROLE_ID}`);
  console.log(`   User Role ID: ${profile.role_id}`);
  console.log(`   Match: ${isAdminByRole ? '✅ YES' : '❌ NO'}`);
  console.log(`   Is Active: ${isActive ? '✅ YES' : '❌ NO'}`);
  
  if (!isAdminByRole) {
    console.log('\n⚠️  USER IS NOT AN ADMIN');
    console.log('   The role_id does not match the admin role ID.');
  } else if (!isActive) {
    console.log('\n⚠️  USER PROFILE IS NOT ACTIVE');
    console.log('   Even though role_id is correct, is_active is false.');
  } else {
    console.log('\n✅ USER SHOULD BE RECOGNIZED AS ADMIN');
    console.log('   Role ID matches and profile is active.');
  }
  
  // Step 4: Test is_admin() function logic
  console.log('\n📋 Step 4: Testing is_admin() function logic...');
  
  // Simulate what the function should do
  const { data: directCheck } = await adminSupabase
    .from('user_profiles')
    .select('role_id')
    .eq('user_id', authUser.id)
    .eq('role_id', ADMIN_ROLE_ID)
    .eq('is_active', true)
    .maybeSingle();
  
  const shouldReturnTrue = !!directCheck;
  console.log(`   Direct query result: ${shouldReturnTrue ? '✅ Should return true' : '❌ Should return false'}`);
  
  if (isAdminByRole && isActive && !shouldReturnTrue) {
    console.log('   ⚠️  WARNING: Direct query failed even though role matches!');
    console.log('   This suggests an RLS policy issue.');
  }
  
  // Step 5: Check function definition
  console.log('\n📋 Step 5: Checking is_admin() function...');
  const { data: functionResult, error: funcError } = await adminSupabase.rpc('is_admin');
  
  if (funcError) {
    console.log(`   ❌ Function error: ${funcError.message}`);
    console.log(`   Code: ${funcError.code}`);
  } else {
    console.log(`   Function result: ${functionResult}`);
    console.log(`   Expected: ${shouldReturnTrue}`);
    
    if (functionResult === shouldReturnTrue) {
      console.log('   ✅ Function result matches expected!');
    } else {
      console.log('   ❌ Function result does NOT match expected!');
      console.log('   This indicates the function has an issue.');
    }
  }
  
  // Step 6: Summary and recommendations
  console.log('\n📋 Step 6: Summary and Recommendations');
  console.log('='.repeat(60));
  
  const issues: string[] = [];
  const fixes: string[] = [];
  
  if (!profile) {
    issues.push('User profile does not exist');
    fixes.push(`INSERT INTO user_profiles (user_id, name, role_id, is_active) VALUES ('${authUser.id}', '${authUser.email?.split('@')[0]}', '${ADMIN_ROLE_ID}', true);`);
  } else {
    if (!isAdminByRole) {
      issues.push(`Role ID (${profile.role_id}) does not match admin role ID (${ADMIN_ROLE_ID})`);
      fixes.push(`UPDATE user_profiles SET role_id = '${ADMIN_ROLE_ID}' WHERE user_id = '${authUser.id}';`);
    }
    
    if (!isActive) {
      issues.push('User profile is not active');
      fixes.push(`UPDATE user_profiles SET is_active = true WHERE user_id = '${authUser.id}';`);
    }
    
    if (isAdminByRole && isActive && functionResult !== true && !funcError) {
      issues.push('is_admin() function returns false even though user is admin');
      fixes.push('Check function definition, RLS policies, and function permissions');
    }
  }
  
  if (issues.length === 0) {
    console.log('\n✅ No issues found! Your account should work correctly.');
    console.log('   If is_admin() still returns false, the issue might be:');
    console.log('   1. Testing in wrong context (service role instead of user session)');
    console.log('   2. Function permissions issue');
    console.log('   3. RLS policy blocking function access');
  } else {
    console.log('\n❌ Issues found:');
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
    
    console.log('\n💡 To fix, run these SQL commands in Supabase SQL Editor:');
    fixes.forEach((fix, i) => {
      console.log(`\n   ${i + 1}. ${fix}`);
    });
    
    // Note: We can't automatically fix function issues, but we can fix profile issues
    if (issues.some(i => i.includes('profile') || i.includes('Role ID'))) {
      console.log('\n🤖 Would you like me to fix profile issues automatically? (y/n)');
      const answer = await question('> ');
      
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        console.log('\n🔧 Applying fixes...');
        
        if (!profile) {
          const { error } = await adminSupabase
            .from('user_profiles')
            .insert({
              user_id: authUser.id,
              name: authUser.email?.split('@')[0] || 'User',
              role_id: ADMIN_ROLE_ID,
              is_active: true
            });
          if (error) {
            console.error(`   ❌ Error: ${error.message}`);
          } else {
            console.log('   ✅ Profile created');
          }
        } else {
          const updates: any = {};
          if (!isAdminByRole) updates.role_id = ADMIN_ROLE_ID;
          if (!isActive) updates.is_active = true;
          
          if (Object.keys(updates).length > 0) {
            const { error } = await adminSupabase
              .from('user_profiles')
              .update(updates)
              .eq('user_id', authUser.id);
            
            if (error) {
              console.error(`   ❌ Error: ${error.message}`);
            } else {
              console.log('   ✅ Profile updated');
            }
          }
        }
        
        console.log('\n✅ Fixes applied! Please test again.');
      }
    }
  }
  
  console.log('\n✨ Account check completed!');
}

async function listAllUsers() {
  console.log('\n📋 All users in the system:\n');
  
  const { data: { users }, error } = await adminSupabase.auth.admin.listUsers();
  
  if (error) {
    console.error('❌ Error listing users:', error.message);
    return;
  }
  
  if (!users) {
    console.log('No users found');
    return;
  }
  
  for (const user of users) {
    const { data: profile } = await adminSupabase
      .from('user_profiles')
      .select('name, role_id, is_active, roles:role_id(name)')
      .eq('user_id', user.id)
      .maybeSingle();
    
    const isAdmin = profile?.role_id === ADMIN_ROLE_ID;
    const roleName = (profile?.roles as any)?.name || 'N/A';
    
    console.log(`📧 ${user.email}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Profile: ${profile ? '✅' : '❌ Missing'}`);
    if (profile) {
      console.log(`   Name: ${profile.name}`);
      console.log(`   Role: ${roleName} ${isAdmin ? '👑 (ADMIN)' : ''}`);
      console.log(`   Active: ${profile.is_active ? '✅' : '❌'}`);
    }
    console.log('');
  }
}

async function main() {
  console.log('🔍 Account Status Checker\n');
  console.log('='.repeat(60));
  
  const email = process.argv[2];
  
  if (email) {
    await checkUserByEmail(email);
  } else {
    console.log('Usage: npm run check:account <email>');
    console.log('   or: ts-node scripts/check-my-account.ts <email>\n');
    
    const action = await question('Would you like to:\n  1. Check a specific user by email\n  2. List all users\n  3. Exit\n\nEnter choice (1-3): ');
    
    if (action === '1') {
      const email = await question('\nEnter email address: ');
      await checkUserByEmail(email);
    } else if (action === '2') {
      await listAllUsers();
    }
  }
  
  rl.close();
}

main().catch((error) => {
  console.error('❌ Error:', error);
  rl.close();
  process.exit(1);
});

