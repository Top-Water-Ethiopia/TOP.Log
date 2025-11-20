/**
 * Utility script to create a superadmin user in Supabase
 * 
 * Usage:
 * 1. Register a user via the app or Supabase dashboard
 * 2. Run this script with the user's email
 * 
 * Or use the SQL directly in Supabase SQL Editor:
 * 
 * UPDATE user_profiles 
 * SET role_id = '00000000-0000-0000-0000-000000000001'
 * WHERE user_id = (
 *   SELECT id FROM auth.users WHERE email = 'your-email@example.com'
 * );
 */

import { supabase } from './supabase-client';

const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Promote a user to admin by email
 */
export async function promoteUserToAdmin(email: string) {
  try {
    // Get the user ID from auth.users
    const { data: authUser, error: authError } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', email)
      .single();

    if (authError || !authUser) {
      throw new Error(`User with email ${email} not found`);
    }

    // Update or insert user profile with admin role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: authUser.id,
        name: 'Super Admin',
        role_id: ADMIN_ROLE_ID,
        is_active: true,
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (profileError) {
      throw profileError;
    }

    console.log(`✅ User ${email} has been promoted to admin`);
    return profile;
  } catch (error) {
    console.error('❌ Error promoting user to admin:', error);
    throw error;
  }
}

/**
 * Create a new admin user directly (requires service role key)
 * Note: This should only be used server-side with service role key
 */
export async function createAdminUser(
  email: string,
  password: string,
  name: string = 'Super Admin'
) {
  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError || !authData.user) {
      throw authError || new Error('Failed to create user');
    }

    // Create user profile with admin role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: authData.user.id,
        name,
        role_id: ADMIN_ROLE_ID,
        is_active: true,
      })
      .select()
      .single();

    if (profileError) {
      throw profileError;
    }

    console.log(`✅ Admin user created: ${email}`);
    return { user: authData.user, profile };
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  }
}








