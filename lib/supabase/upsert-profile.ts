import { supabase } from './client';
import { User } from '@supabase/supabase-js';
import type { Database } from '../supabase.types';

/**
 * Upsert user profile for the given Supabase user.
 * Call this after login if profile is missing.
 */
export async function upsertUserProfile(user: User, {
  name,
  role_id = '00000000-0000-0000-0000-000000000002', // default: user role
  department_id = null,
  is_active = true,
}: {
  name: string,
  role_id?: string,
  department_id?: string | null,
  is_active?: boolean,
}) {
  if (!user) throw new Error('No user provided');
  const profile: Database['public']['Tables']['user_profiles']['Insert'] = {
    id: crypto.randomUUID(),
    user_id: user.id,
    name,
    role_id,
    department_id,
    is_active,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('user_profiles').upsert(profile, { onConflict: 'user_id' }).select().single();
  if (error) throw error;
  return data;
}
