import { User as SupabaseUser } from '@supabase/supabase-js';
import { User } from '@/lib/rbac/types';

export function mapSupabaseUserToRbacUser(supabaseUser: SupabaseUser | null, profile?: any): User | null {
  if (!supabaseUser) return null;
  
  // Default role based on whether profile exists and has role_name
  // If no profile or no role_name, default to 'programmer' (level 3) instead of 'viewer' (level 1)
  // This ensures users can create entries by default
  const defaultRole: User['role'] = 'programmer';
  
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    name: profile?.name || supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
    avatar: profile?.avatar || undefined,
    role: (profile?.role_name as User['role']) || defaultRole,
    department: profile?.department_id || undefined,
    isActive: profile?.is_active ?? true,
    lastLogin: profile?.last_login || undefined,
    createdAt: profile?.created_at || supabaseUser.created_at || new Date().toISOString(),
    updatedAt: profile?.updated_at || supabaseUser.updated_at || new Date().toISOString(),
    metadata: supabaseUser.user_metadata || {},
  };
}
