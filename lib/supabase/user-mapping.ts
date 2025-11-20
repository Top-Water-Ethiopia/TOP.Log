import { User as SupabaseUser } from '@supabase/supabase-js';
import { User } from '@/lib/rbac/types';

export function mapSupabaseUserToRbacUser(supabaseUser: SupabaseUser | null, profile?: any): User | null {
  if (!supabaseUser) return null;
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    name: profile?.name || supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
    avatar: profile?.avatar || undefined,
    role: (profile?.role_name as User['role']) || 'viewer',
    department: profile?.department || undefined,
    isActive: profile?.is_active ?? true,
    lastLogin: profile?.last_login || undefined,
    createdAt: profile?.created_at || supabaseUser.created_at || new Date().toISOString(),
    updatedAt: profile?.updated_at || supabaseUser.updated_at || new Date().toISOString(),
    metadata: supabaseUser.user_metadata || {},
  };
}
