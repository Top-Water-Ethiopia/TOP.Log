import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let supabaseUrl: string;
let supabaseKey: string;

// Check if we're in a browser environment
if (typeof window !== 'undefined') {
  // Client-side: use the public environment variables
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
} else {
  // Server-side: use the private environment variables
  supabaseUrl = process.env.SUPABASE_URL || '';
  supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

if (!supabaseUrl || !supabaseKey) {
  if (typeof window !== 'undefined') {
    console.error('Supabase credentials not found in environment variables.');
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Helper functions for authentication
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function resetPassword(email: string) {
  return supabase.auth.resetPasswordForEmail(email);
}

export async function updatePassword(password: string) {
  return supabase.auth.updateUser({ password });
}
