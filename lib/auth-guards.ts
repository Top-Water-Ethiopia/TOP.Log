import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getUserEffectiveDepartmentMemberships } from "@/lib/server/department-reporting"
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
    .from("role_permissions")
    .select("id")
    .eq("role_id", roleId)
    .eq("resource", "admin")
    .eq("action", "system")
    .eq("effect", "allow")
    .limit(1)

  return !!(adminPerm && adminPerm.length > 0)
}

/**
 * Checks if user has any effective department memberships
 * (profession assignment OR access-level with department_questions.answer permission)
 */
export async function checkDepartmentMembership(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const memberships = await getUserEffectiveDepartmentMemberships(supabase, userId)
  return memberships.length > 0
}

/**
 * Checks if user has membership in a specific department
 */
export async function checkSpecificDepartmentMembership(userId: string, departmentId: string): Promise<boolean> {
  const supabase = await createClient()
  const memberships = await getUserEffectiveDepartmentMemberships(supabase, userId)
  return memberships.some((m) => m.departmentId === departmentId)
}
