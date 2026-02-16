import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermissionFromRequest } from "@/lib/rbac/server"

export const dynamic = "force-dynamic"

// Map roles to access levels for backward compatibility
const roleToAccessLevelMap: Record<string, string> = {
  member: "contributor",
  lead: "department-lead",
  manager: "department-manager",
  supervisor: "supervisor",
  viewer: "viewer",
}

export async function GET(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { departmentId } = await params

    // Get users with access levels that allow answering department questions
    // First, find the permission_definition_id for department_questions.answer
    const { data: permDef } = await adminSupabase
      .from("permission_definitions")
      .select("id")
      .eq("resource", "department_questions")
      .eq("action", "answer")
      .single()

    if (!permDef) {
      return NextResponse.json({ data: { allowedRoles: [] } })
    }

    const { data: rows, error } = await adminSupabase
      .from("user_department_access_levels")
      .select(
        `
        user_id,
        access_level_id,
        department_access_levels!inner (
          name,
          display_name
        ),
        department_access_level_permissions!inner (
          effect,
          permission_definition_id
        )
      `
      )
      .eq("department_id", departmentId)
      .eq("department_access_level_permissions.permission_definition_id", permDef.id)
      .eq("department_access_level_permissions.effect", "allow")
      .limit(10000)

    if (error) {
      return NextResponse.json({ error: "Failed to load access control", message: error.message }, { status: 500 })
    }

    // Get the department roles for these users (for backward compatibility)
    const userIds = (rows || []).map((r) => r.user_id).filter(Boolean)
    const { data: userRoles } = await adminSupabase
      .from("user_department_roles")
      .select("user_id, role")
      .eq("department_id", departmentId)
      .eq("is_active", true)
      .in("user_id", userIds)

    const allowedRoles = (userRoles || [])
      .map((r) => r.role)
      .filter((r): r is string => typeof r === "string" && r.length > 0)
      .filter((role, index, arr) => arr.indexOf(role) === index) // Remove duplicates

    return NextResponse.json({ data: { allowedRoles } })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load access control", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({}))

    const allowedRolesRaw = body.allowedRoles
    if (!Array.isArray(allowedRolesRaw)) {
      return NextResponse.json({ error: "allowedRoles must be an array" }, { status: 400 })
    }

    const allowedRoles = Array.from(new Set(allowedRolesRaw.filter((r: unknown): r is string => typeof r === "string")))

    if (allowedRoles.length > 0) {
      const { data: validRows, error: rolesError } = await adminSupabase
        .from("department_roles")
        .select("key")
        .in("key", allowedRoles)
        .eq("is_active", true)
        .limit(10000)

      if (rolesError) {
        return NextResponse.json({ error: "Failed to validate roles", message: rolesError.message }, { status: 500 })
      }

      const validKeys = new Set((validRows || []).map((r) => r.key))
      const invalid = allowedRoles.filter((r) => !validKeys.has(r))
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `Invalid Department Access Control role(s): ${invalid.join(", ")}` },
          { status: 400 }
        )
      }
    }

    // Map roles to access levels
    const accessLevelsToAllow = allowedRoles
      .map((role) => roleToAccessLevelMap[role] || "contributor")
      .filter((level, index, arr) => arr.indexOf(level) === index) // Remove duplicates

    // Get all access levels
    const { data: allAccessLevels } = await adminSupabase
      .from("department_access_levels")
      .select("id, name")
      .eq("is_active", true)

    if (!allAccessLevels) {
      return NextResponse.json({ error: "Failed to load access levels" }, { status: 500 })
    }

    // Get existing permissions for department_questions.answer
    const { data: permDef } = await adminSupabase
      .from("permission_definitions")
      .select("id")
      .eq("resource", "department_questions")
      .eq("action", "answer")
      .single()

    if (!permDef) {
      return NextResponse.json({ error: "Permission definition not found" }, { status: 500 })
    }

    const { data: existingRows, error: existingError } = await adminSupabase
      .from("department_access_level_permissions")
      .select("id, access_level_id")
      .in(
        "access_level_id",
        allAccessLevels.map((al) => al.id)
      )
      .eq("permission_definition_id", permDef.id)
      .eq("effect", "allow")
      .limit(10000)

    if (existingError) {
      return NextResponse.json(
        { error: "Failed to load existing grants", message: existingError.message },
        { status: 500 }
      )
    }

    const existingAccessLevelIds = new Set((existingRows || []).map((r) => r.access_level_id))
    const allowedAccessLevelIds = new Set(
      allAccessLevels.filter((al) => accessLevelsToAllow.includes(al.name)).map((al) => al.id)
    )

    const toAdd = Array.from(allowedAccessLevelIds).filter((id) => !existingAccessLevelIds.has(id))
    const toRemove = Array.from(existingAccessLevelIds).filter((id) => !allowedAccessLevelIds.has(id))

    // Remove permissions for access levels that should no longer have access
    if (toRemove.length > 0) {
      const { error: deleteError } = await adminSupabase
        .from("department_access_level_permissions")
        .delete()
        .in("id", toRemove)

      if (deleteError) {
        return NextResponse.json({ error: "Failed to remove grants", message: deleteError.message }, { status: 500 })
      }
    }

    // Add permissions for new access levels
    if (toAdd.length > 0) {
      const { error: insertError } = await adminSupabase.from("department_access_level_permissions").insert(
        toAdd.map((access_level_id) => ({
          access_level_id,
          permission_definition_id: permDef.id,
          effect: "allow",
          created_by: auth.userId,
          updated_by: auth.userId,
          updated_at: new Date().toISOString(),
        }))
      )

      if (insertError) {
        return NextResponse.json({ error: "Failed to add grants", message: insertError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ data: { allowedRoles } })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update access control", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
