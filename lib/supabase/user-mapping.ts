import { User as SupabaseUser } from "@supabase/supabase-js"
import { User } from "@/lib/rbac/types"

type ProfileWithRoleName = {
  name?: string | null
  avatar?: string | null
  role_name?: string | null
  roles?: {
    name?: string | null
  } | null
  department_id?: string | null
  is_active?: boolean | null
  last_login?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export function mapSupabaseUserToRbacUser(
  supabaseUser: SupabaseUser | null,
  profile?: ProfileWithRoleName
): User | null {
  if (!supabaseUser) return null

  // Default role based on whether profile exists and has role_name
  // If no profile or no role_name, default to 'programmer' (level 3) instead of 'viewer' (level 1)
  // This ensures users can create entries by default
  const defaultRole: User["role"] = "programmer"

  const roleNameCandidate = profile?.role_name ?? profile?.roles?.name ?? null

  return {
    id: supabaseUser.id,
    email: supabaseUser.email || "",
    name: profile?.name || supabaseUser.user_metadata?.name || supabaseUser.email?.split("@")[0] || "User",
    avatar: profile?.avatar || undefined,
    role: (roleNameCandidate as User["role"]) || defaultRole,
    department: profile?.department_id || undefined,
    isActive: profile?.is_active ?? true,
    lastLogin: profile?.last_login || undefined,
    createdAt: profile?.created_at || supabaseUser.created_at || new Date().toISOString(),
    updatedAt: profile?.updated_at || supabaseUser.updated_at || new Date().toISOString(),
    metadata: supabaseUser.user_metadata || {},
  }
}
