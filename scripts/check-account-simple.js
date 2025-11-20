/**
 * Simple script to check your account status
 * Usage: node scripts/check-account-simple.js <your-email>
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000001';
const email = process.argv[2];

if (!email) {
  console.log('Usage: node scripts/check-account-simple.js <your-email>');
  console.log('\nOr check all users:');
  console.log('  node scripts/check-account-simple.js --list');
  process.exit(1);
}

async function checkAccount(email) {
  console.log(`\n🔍 Checking account: ${email}\n`);
  console.log('='.repeat(60));
  
  // Find user
  const { data: { users }, error: listError } = await adminSupabase.auth.admin.listUsers();
  if (listError) {
    console.error('❌ Error:', listError.message);
    return;
  }
  
  const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.log(`❌ User not found: ${email}`);
    return;
  }
  
  console.log(`✅ User found: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  
  // Check profile
  const { data: profile, error: profileError } = await adminSupabase
    .from('user_profiles')
    .select('*, roles:role_id(name)')
    .eq('user_id', user.id)
    .maybeSingle();
  
  if (profileError) {
    console.error('❌ Profile error:', profileError.message);
    return;
  }
  
  if (!profile) {
    console.log('❌ Profile does NOT exist!');
    console.log('\n💡 To fix, run this SQL:');
    console.log(`UPDATE user_profiles SET role_id = '${ADMIN_ROLE_ID}', is_active = true WHERE user_id = '${user.id}';`);
    console.log(`\nOr create profile:`);
    console.log(`INSERT INTO user_profiles (user_id, name, role_id, is_active)`);
    console.log(`VALUES ('${user.id}', '${user.email.split('@')[0]}', '${ADMIN_ROLE_ID}', true);`);
    return;
  }
  
  console.log(`\n✅ Profile found:`);
  console.log(`   Name: ${profile.name}`);
  console.log(`   Role: ${profile.roles?.name || 'N/A'}`);
  console.log(`   Role ID: ${profile.role_id}`);
  console.log(`   Is Active: ${profile.is_active}`);
  
  const isAdmin = profile.role_id === ADMIN_ROLE_ID && profile.is_active === true;
  
  console.log(`\n📊 Admin Status:`);
  console.log(`   Should be admin: ${isAdmin ? '✅ YES' : '❌ NO'}`);
  
  if (!isAdmin) {
    if (profile.role_id !== ADMIN_ROLE_ID) {
      console.log(`\n❌ ISSUE: Role ID doesn't match admin role`);
      console.log(`   Current: ${profile.role_id}`);
      console.log(`   Expected: ${ADMIN_ROLE_ID}`);
      console.log(`\n💡 Fix:`);
      console.log(`UPDATE user_profiles SET role_id = '${ADMIN_ROLE_ID}' WHERE user_id = '${user.id}';`);
    }
    if (!profile.is_active) {
      console.log(`\n❌ ISSUE: Profile is not active`);
      console.log(`\n💡 Fix:`);
      console.log(`UPDATE user_profiles SET is_active = true WHERE user_id = '${user.id}';`);
    }
  } else {
    console.log(`\n✅ Your account is correctly configured as admin!`);
    console.log(`\n💡 If is_admin() still returns false, the issue is with the function itself.`);
    console.log(`   The function might not be able to read user_profiles due to RLS.`);
    console.log(`   Run the migration: supabase/migrations/20231116000011_fix_is_admin_function.sql`);
  }
  
  // Test function (will return false with service role, but shows if function exists)
  console.log(`\n🔍 Testing is_admin() function...`);
  const { data: funcResult, error: funcError } = await adminSupabase.rpc('is_admin');
  
  if (funcError) {
    console.log(`   ❌ Function error: ${funcError.message}`);
  } else {
    console.log(`   Function result: ${funcResult}`);
    console.log(`   ⚠️  Note: This is called with service role, so auth.uid() is null`);
    console.log(`   To test properly, sign in as the user and call the function.`);
  }
}

async function listAllUsers() {
  const { data: { users }, error } = await adminSupabase.auth.admin.listUsers();
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  console.log(`\n📋 All Users (${users.length} total):\n`);
  
  for (const user of users) {
    const { data: profile } = await adminSupabase
      .from('user_profiles')
      .select('name, role_id, is_active, roles:role_id(name)')
      .eq('user_id', user.id)
      .maybeSingle();
    
    const isAdmin = profile?.role_id === ADMIN_ROLE_ID;
    const roleName = profile?.roles?.name || 'N/A';
    
    console.log(`📧 ${user.email}`);
    console.log(`   Profile: ${profile ? '✅' : '❌ Missing'}`);
    if (profile) {
      console.log(`   Role: ${roleName} ${isAdmin ? '👑' : ''}`);
      console.log(`   Active: ${profile.is_active ? '✅' : '❌'}`);
    }
    console.log('');
  }
}

async function main() {
  if (email === '--list') {
    await listAllUsers();
  } else {
    await checkAccount(email);
  }
}

main().catch(console.error);







