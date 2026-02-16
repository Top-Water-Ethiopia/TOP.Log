import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { adminSupabase } from "@/lib/supabase/admin"

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

    // Get user's active department only (single active department principle)
    const { data: activeDepartmentRole } = await supabase
      .from("user_department_roles")
      .select(
        `
        department_id,
        role,
        department:departments (
          id,
          name,
          description,
          is_active
        )
      `
      )
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()

    let hasSystemWideAccess = false
    if (profile) {
      const { data: permissions } = await adminSupabase
        .from("permissions")
        .select("resource, action")
        .eq("role_id", profile.role_id)

      const permissionNames = permissions?.map((p) => `${p.resource}.${p.action}`) || []
      hasSystemWideAccess =
        permissionNames.includes("departments.read") ||
        permissionNames.includes("departments.own.read") ||
        permissionNames.includes("admin.system")

      // If no system-wide access, check department-scoped access
      if (!hasSystemWideAccess && activeDepartmentRole) {
        // Check department access level permissions
        const { data: userAccessLevel } = await supabase
          .from("user_department_access_levels")
          .select("access_level_id")
          .eq("user_id", user.id)
          .eq("department_id", activeDepartmentRole.department_id)
          .single()

        if (userAccessLevel?.access_level_id) {
          const { data: accessLevelPermissions } = await adminSupabase
            .from("department_access_level_permissions")
            .select(
              `
              permission_definitions!inner(resource, action)
            `
            )
            .eq("access_level_id", userAccessLevel.access_level_id)
            .eq("effect", "allow")

          const accessLevelPermissionNames =
            accessLevelPermissions?.map((p) => {
              const pd = p.permission_definitions as { resource: string; action: string }
              return `${pd.resource}.${pd.action}`
            }) || []

          if (accessLevelPermissionNames.includes("departments.read")) {
            hasSystemWideAccess = true
          }
        }
      }
    }

    // Normalize the response
    const normalized: Array<{
      department_id: string
      department: {
        id: string
        name: string
        description: string | null
        is_active: boolean
      }
      role: string
    }> = []
    if (activeDepartmentRole && activeDepartmentRole.department) {
      normalized.push({
        department_id: activeDepartmentRole.department_id,
        department: {
          id: activeDepartmentRole.department.id,
          name: activeDepartmentRole.department.name,
          description: activeDepartmentRole.department.description,
          is_active: activeDepartmentRole.department.is_active,
        },
        role: activeDepartmentRole.role,
      })
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
