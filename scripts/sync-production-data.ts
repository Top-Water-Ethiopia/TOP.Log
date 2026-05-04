import * as crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
const prodEnv = dotenv.config({ path: '.env.production' }).parsed || {};
const devEnv = dotenv.config({ path: '.env.local' }).parsed || {};

async function syncProductionData() {
  console.log('🚀 Starting Production to Dev Data Sync (Hardened)...');

  // 1. Initialize Clients
  const prodSupabase = createClient(
    prodEnv.NEXT_PUBLIC_SUPABASE_URL!,
    prodEnv.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const devSupabase = createClient(
    devEnv.NEXT_PUBLIC_SUPABASE_URL!,
    devEnv.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  function generateRandomPassword() {
    return crypto.randomBytes(16).toString('hex');
  }

  try {
    // 2. Sync Departments
    console.log('\n🏢 Syncing Departments...');
    const { data: depts, error: deptsErr } = await prodSupabase.from('departments').select('*');
    if (deptsErr) throw deptsErr;
    
    for (const dept of depts) {
      const { error } = await devSupabase.from('departments').upsert(dept);
      if (error) console.error(`  ❌ Error syncing dept ${dept.name}:`, error.message);
      else console.log(`  ✅ Synced dept: ${dept.name}`);
    }

    // 3. Sync Roles
    console.log('\n🎭 Syncing Roles...');
    const { data: roles, error: rolesErr } = await prodSupabase.from('roles').select('*');
    if (rolesErr) throw rolesErr;

    for (const role of roles) {
      const { error } = await devSupabase.from('roles').upsert(role);
      if (error) console.error(`  ❌ Error syncing role ${role.name}:`, error.message);
      else console.log(`  ✅ Synced role: ${role.name}`);
    }

    // 4. Sync Auth Users with unique random passwords
    console.log('\n👤 Syncing Auth Users with unique random passwords...');
    const { data: { users: prodUsers }, error: usersErr } = await prodSupabase.auth.admin.listUsers();
    if (usersErr) throw usersErr;

    for (const user of prodUsers) {
      const randomPassword = generateRandomPassword();
      const { error } = await devSupabase.auth.admin.createUser({
        id: user.id,
        email: user.email,
        password: randomPassword,
        email_confirm: true,
        phone: user.phone,
        phone_confirm: true,
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata
      });

      if (error && error.message.includes('already exists')) {
        await devSupabase.auth.admin.updateUserById(user.id, {
          password: randomPassword,
          phone: user.phone,
          phone_confirm: true,
          user_metadata: user.user_metadata,
          app_metadata: user.app_metadata
        });
        console.log(`  ✅ Reset password for: ${user.email}`);
      } else if (error) {
        console.error(`  ❌ Error syncing user ${user.email}:`, error.message);
      } else {
        console.log(`  ✅ Created user: ${user.email}`);
      }
    }

    // 5. Sync User Profiles
    console.log('\n📄 Syncing User Profiles...');
    const { data: profiles, error: profilesErr } = await prodSupabase.from('user_profiles').select('*');
    if (profilesErr) throw profilesErr;

    for (const profile of profiles) {
      const { error } = await devSupabase.from('user_profiles').upsert(profile);
      if (error) console.error(`  ❌ Error syncing profile for ${profile.user_id}:`, error.message);
      else console.log(`  ✅ Synced profile: ${profile.name}`);
    }

    // 6. Sync User Department Memberships
    console.log('\n🔗 Syncing User Department Memberships...');
    const { data: memberships, error: membershipsErr } = await prodSupabase.from('user_department_memberships').select('*');
    if (membershipsErr) throw membershipsErr;

    for (const membership of memberships) {
      const { error } = await devSupabase.from('user_department_memberships').upsert(membership);
      if (error) console.error(`  ❌ Error syncing membership ${membership.id}:`, error.message);
      else console.log(`  ✅ Synced membership for user ${membership.user_id}`);
    }

    console.log('\n✨ Data Sync Completed Successfully!');
    console.log('\n🔐 All users reset with unique random passwords for development security.');

  } catch (error) {
    console.error('\n💥 Critical Error during sync:', error);
    process.exit(1);
  }
}

syncProductionData();
