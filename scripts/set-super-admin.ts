/**
 * Script to set a user as super admin and reset credentials
 * 
 * Usage: npx tsx scripts/set-super-admin.ts
 * 
 * This script sets the user with email: info@topwaterethiopia.com as super admin
 * and resets their password to: Admin@123456
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
  const USER_EMAIL = 'info@topwaterethiopia.com';
  const USER_PASSWORD = 'Admin@123456';

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
          } as any)
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

      let user = users.find(u => u.email === USER_EMAIL);
      
      if (!user) {
        // Create the user if it doesn't exist
        console.log(`📝 User not found. Creating new user...\n`);
        const { data: newUser, error: createUserError } = await adminSupabase.auth.admin.createUser({
          email: USER_EMAIL,
          password: USER_PASSWORD,
          email_confirm: true, // Auto-confirm email
        });

        if (createUserError) {
          throw new Error(`Failed to create user: ${createUserError.message}`);
        }

        if (!newUser.user) {
          throw new Error('Failed to create user: No user returned');
        }

        user = newUser.user;
        console.log(`✅ Created new user: ${user.email} (ID: ${user.id})\n`);
      } else {
        // Update password for existing user
        console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);
        console.log(`🔑 Resetting password...\n`);
        
        const { data: updatedUser, error: updatePasswordError } = await adminSupabase.auth.admin.updateUserById(
          user.id,
          {
            password: USER_PASSWORD,
            email_confirm: true, // Ensure email is confirmed
          }
        );

        if (updatePasswordError) {
          throw new Error(`Failed to update password: ${updatePasswordError.message}`);
        }

        console.log(`✅ Password reset successfully!\n`);
      }

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
        console.log(`   - Role ID: ${(profile as any).role_id}`);
        console.log(`   - Name: ${(profile as any).name || 'N/A'}`);
        console.log(`   - Department: ${(profile as any).department || 'N/A'}\n`);

        // Update existing profile
        const { data: updatedProfile, error: updateError } = await (adminSupabase
          .from('user_profiles') as any)
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

        if (!updatedProfile) {
          throw new Error('Failed to update user profile: No profile returned');
        }

        console.log(`✅ Successfully updated user profile to super admin!`);
        console.log(`   - New Role ID: ${(updatedProfile as any).role_id}`);
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
          } as any)
          .select()
          .single();

        if (createError) {
          throw new Error(`Failed to create user profile: ${createError.message}`);
        }

        if (!newProfile) {
          throw new Error('Failed to create user profile: No profile returned');
        }

        console.log(`✅ Successfully created user profile with super admin role!`);
        console.log(`   - Role ID: ${(newProfile as any).role_id}`);
      }

      console.log(`\n🎉 ${USER_EMAIL} is now a super admin!`);
      console.log(`\n📋 Credentials:`);
      console.log(`   - Email: ${USER_EMAIL}`);
      console.log(`   - Password: ${USER_PASSWORD}`);
      console.log(`\n💡 Next steps:`);
      console.log(`   1. Log out and log back in with the credentials above`);
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

