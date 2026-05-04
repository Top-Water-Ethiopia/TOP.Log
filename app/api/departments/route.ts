import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { adminSupabase } from "@/lib/supabase/admin"
import {
  getUserEffectiveDepartmentMemberships,
  type EffectiveDepartmentMembership,
} from "@/lib/server/department-reporting"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check system-wide permissions
    const { data: profile } = await adminSupabase
      .from("user_profiles")
      .select("role_id")
      .eq("user_id", user.id)
      .single()

    let hasSystemWideAccess = false
    if (profile) {
      const { data: permissions } = await adminSupabase
        .from("role_permissions")
        .select("resource, action")
        .eq("role_id", profile.role_id)

      const permissionNames = permissions?.map((p) => `${p.resource}.${p.action}`) || []
      hasSystemWideAccess =
        permissionNames.includes("departments.read") ||
        permissionNames.includes("departments.own.read") ||
        permissionNames.includes("admin.system")

      // If no system-wide access, check department-scoped access
      if (!hasSystemWideAccess) {
        const memberships = await getUserEffectiveDepartmentMemberships(supabase, user.id)
        for (const membership of memberships) {
          // memberships already contain all resolved permissions in "resource.action" format
          if (membership.permissions.includes("departments.read")) {
            hasSystemWideAccess = true
            break
          }
        }
      }
    }

    let normalized

    if (hasSystemWideAccess) {
      // Fetch ALL departments for system-wide access (e.g., move member dialog)
      const { data: allDepartments, error: deptError } = await adminSupabase
        .from("departments")
        .select("id, name, description, is_active, created_at, updated_at")
        .order("name")

      if (deptError) {
        throw deptError
      }

      normalized = (allDepartments || []).map((dept) => ({
        department_id: dept.id,
        department: { name: dept.name },
        roleType: null,
        roleKey: null,
        roleLabel: null,
        canViewReports: false,
        canCreateReports: false,
        canAnswerDepartmentReports: false,
        role: null,
        department_profession: null,
      }))
    } else {
      // Get effective department memberships including inactive ones (for locked UI display)
      const memberships = await getUserEffectiveDepartmentMemberships(supabase, user.id, true)

      // Map to API response shape with both new fields and legacy backwards compatibility
      normalized = memberships.map((membership: EffectiveDepartmentMembership) => ({
        // Department info
        department_id: membership.departmentId,
        department: membership.department,

        // Effective role (new contract)
        roleType: membership.roleType,
        roleKey: membership.roleKey,
        roleLabel: membership.roleLabel,

        // Explicit capabilities (new contract)
        canViewReports: membership.canViewReports,
        canCreateReports: membership.canCreateReports,
        canAnswerDepartmentReports: membership.canAnswerDepartmentReports,

        // Legacy fields (for backwards compatibility - NO NEW CONSUMERS SHOULD USE THESE)
        role: membership.roleKey,
        department_profession: membership.roleKey ? { key: membership.roleKey } : null,
      }))
    }

    // Return both system-wide access flag and department list
    return NextResponse.json({
      data: normalized,
      hasSystemWideAccess,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
