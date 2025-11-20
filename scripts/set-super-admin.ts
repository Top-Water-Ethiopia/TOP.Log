/**
 * Script to set a user as super admin
 * 
 * Usage: npx tsx scripts/set-super-admin.ts
 * 
 * This script sets the user with email: contact.samuelerbo@gmail.com as super admin
 */

// Load environment variables FIRST before any other imports
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file from project root
const projectRoot = process.cwd();
dotenv.config({ path: path.resolve(projectRoot, '.env.local') });
dotenv.config({ path: path.resolve(projectRoot, '.env') });

// Now import after env vars are loaded using dynamic import
async function runScript() {
  const { adminSupabase } = await import('../lib/supabase/admin');

  const SUPER_ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000000';
  const USER_EMAIL = 'contact.samuelerbo@gmail.com';

  async function setSuperAdmin() {
    try {
      console.log(`🔐 Setting ${USER_EMAIL} as super admin...\n`);

      // First, ensure the super admin role exists
      console.log(`📋 Checking if super admin role exists...`);
      const { data: existingRole, error: roleCheckError } = await adminSupabase
        .from('roles')
        .select('*')
        .eq('id', SUPER_ADMIN_ROLE_ID)
        .single();

      if (roleCheckError && roleCheckError.code !== 'PGRST116') {
        throw new Error(`Failed to check role: ${roleCheckError.message}`);
      }

      if (!existingRole) {
        console.log(`📝 Creating super admin role...`);
        const { data: newRole, error: createRoleError } = await adminSupabase
          .from('roles')
          .insert({
            id: SUPER_ADMIN_ROLE_ID,
            name: 'super-admin',
            description: 'Super Administrator with ultimate system access',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createRoleError) {
          throw new Error(`Failed to create super admin role: ${createRoleError.message}`);
        }
        console.log(`✅ Super admin role created!\n`);
      } else {
        console.log(`✅ Super admin role already exists!\n`);
      }

      // Get the user by email using admin client
      const { data: { users }, error: listError } = await adminSupabase.auth.admin.listUsers();
      
      if (listError) {
        throw new Error(`Failed to list users: ${listError.message}`);
      }

      const user = users.find(u => u.email === USER_EMAIL);
      
      if (!user) {
        throw new Error(`User with email ${USER_EMAIL} not found`);
      }

      console.log(`✅ Found user: ${user.email} (ID: ${user.id})\n`);

      // Check if user profile exists
      const { data: profile, error: profileError } = await adminSupabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw new Error(`Failed to check user profile: ${profileError.message}`);
      }

      if (profile) {
        console.log(`📋 Current profile:`);
        console.log(`   - Role ID: ${profile.role_id}`);
        console.log(`   - Name: ${profile.name || 'N/A'}`);
        console.log(`   - Department: ${profile.department || 'N/A'}\n`);

        // Update existing profile
        const { data: updatedProfile, error: updateError } = await adminSupabase
          .from('user_profiles')
          .update({ 
            role_id: SUPER_ADMIN_ROLE_ID,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .select()
          .single();

        if (updateError) {
          throw new Error(`Failed to update user profile: ${updateError.message}`);
        }

        console.log(`✅ Successfully updated user profile to super admin!`);
        console.log(`   - New Role ID: ${updatedProfile.role_id}`);
      } else {
        // Create new profile with super admin role
        console.log(`📝 Creating new user profile with super admin role...\n`);

        const { data: newProfile, error: createError } = await adminSupabase
          .from('user_profiles')
          .insert({
            user_id: user.id,
            role_id: SUPER_ADMIN_ROLE_ID,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Super Admin',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) {
          throw new Error(`Failed to create user profile: ${createError.message}`);
        }

        console.log(`✅ Successfully created user profile with super admin role!`);
        console.log(`   - Role ID: ${newProfile.role_id}`);
      }

      console.log(`\n🎉 ${USER_EMAIL} is now a super admin!`);
      console.log(`\n💡 Next steps:`);
      console.log(`   1. Log out and log back in to refresh your session`);
      console.log(`   2. Visit /admin/role-questions to see your questions`);
      console.log(`   3. You should now have full access to all admin features`);

    } catch (error: any) {
      console.error(`\n❌ Error: ${error.message}`);
      console.error(`\nStack trace:`, error.stack);
      process.exit(1);
    }
  }

  await setSuperAdmin();
}

runScript().catch(console.error);

