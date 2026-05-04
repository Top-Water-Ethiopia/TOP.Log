/**
 * Script to update superadmin password
 * 
 * Usage: npx tsx scripts/update-admin-password.ts
 * 
 * This script updates the password for the superadmin user with email: contact.samuelerbo@gmail.com
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

  const ADMIN_EMAIL = 'contact.samuelerbo@gmail.com';
  const NEW_PASSWORD = 'admin123';

  async function updateAdminPassword() {
    try {
      console.log(`🔐 Updating password for admin user: ${ADMIN_EMAIL}...`);

      // First, get the user by email using admin client
      const { data: { users }, error: listError } = await adminSupabase.auth.admin.listUsers();
      
      if (listError) {
        throw new Error(`Failed to list users: ${listError.message}`);
      }

      // Find the user by email
      const user = users?.find(u => u.email === ADMIN_EMAIL);

      if (!user) {
        throw new Error(`User with email ${ADMIN_EMAIL} not found`);
      }

      console.log(`✅ Found user: ${user.id} (${user.email})`);

      // Update the password using admin client
      const { data: updatedUser, error: updateError } = await adminSupabase.auth.admin.updateUserById(
        user.id,
        {
          password: NEW_PASSWORD,
        }
      );

      if (updateError) {
        throw new Error(`Failed to update password: ${updateError.message}`);
      }

      console.log(`✅ Password updated successfully for ${ADMIN_EMAIL}`);
      console.log(`📧 Email: ${updatedUser.user?.email}`);
      console.log(`🆔 User ID: ${updatedUser.user?.id}`);
      console.log(`\n✨ New password: ${NEW_PASSWORD}`);
      console.log(`\n⚠️  Please keep this password secure!`);

    } catch (error) {
      console.error('❌ Error updating password:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
      }
      process.exit(1);
    }
  }

  // Run the update
  await updateAdminPassword();
  console.log('\n✅ Script completed successfully');
  process.exit(0);
}

// Run the script
runScript()
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
