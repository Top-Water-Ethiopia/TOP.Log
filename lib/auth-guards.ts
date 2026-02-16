import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { User } from "@supabase/supabase-js"

/**
 * Ensures user is authenticated, redirects to login if not
 */
export async function requireAuth(): Promise<User> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return user
}

/**
 * Gets user profile with role information
 */
export async function getUserProfile(userId: string) {
  const supabase = await createClient()
  const { data: profile } = await supabase.from("user_profiles").select("role_id").eq("user_id", userId).maybeSingle()

  return profile
}

/**
 * Checks if user has admin system permissions
 */
export async function checkAdminPermissions(roleId: string | null): Promise<boolean> {
  if (!roleId) return false

  const supabase = await createClient()
  const { data: adminPerm } = await supabase
    .from("permissions")
    .select("id")
    .eq("role_id", roleId)
    .eq("resource", "admin")
    .eq("action", "system")
    .limit(1)

  return !!(adminPerm && adminPerm.length > 0)
}

/**
 * Checks if user has any active department memberships
 */
export async function checkDepartmentMembership(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data: deptRole } = await supabase
    .from("user_department_roles")
    .select("department_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)

  return !!(deptRole && deptRole.length > 0)
}
