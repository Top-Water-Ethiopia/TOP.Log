import { supabase } from './supabase-client';
import type { User } from '@supabase/supabase-js';

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // Do not throw here so UI can handle expected invalid-credentials gracefully
  return data;
}

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Reset password for an email
 */
export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  
  if (error) throw error;
  return data;
}

/**
 * Update user password
 */
export async function updatePassword(password: string) {
  const { data, error } = await supabase.auth.updateUser({
    password,
  });
  
  if (error) throw error;
  return data;
}

/**
 * Get the current user
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Get the current session
 */
export async function getCurrentSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Setup a listener for auth state changes
 */
export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });
}

/**
 * Create a user profile after sign up
 */
export async function createUserProfile(
  userId: string, 
  name: string, 
  roleId: string = '00000000-0000-0000-0000-000000000002', // Default to "user" role
  department?: string,
  metadata?: any,
) {
  const { data, error } = await supabase
    .from('user_profiles')
    .insert({
      user_id: userId,
      name,
      role_id: roleId,
      department,
      is_active: true,
      metadata,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
