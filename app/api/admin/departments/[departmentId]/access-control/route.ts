import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermissionFromRequest } from "@/lib/rbac/server"

export const dynamic = "force-dynamic"

// Legacy compatibility for older clients that still submit profession keys.
const legacyRoleToAccessLevelMap: Record<string, string> = {
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

    await params

    const { data: permissionDefinition } = await adminSupabase
      .from("permission_definitions")
      .select("id")
      .eq("resource", "department_questions")
      .eq("action", "answer")
      .single()

    const { data: accessLevels, error: accessLevelsError } = await adminSupabase
      .from("department_access_levels")
      .select("id, name, display_name, description, level, is_active")
      .eq("is_active", true)
      .order("level", { ascending: false })

    if (accessLevelsError) {
      return NextResponse.json(
        { error: "Failed to load access levels", message: accessLevelsError.message },
        { status: 500 }
      )
    }

    if (!permissionDefinition?.id) {
      return NextResponse.json({ data: { accessLevels: accessLevels || [], allowedAccessLevels: [] } })
    }

    const { data: existingRows, error: existingError } = await adminSupabase
      .from("department_access_level_permissions")
      .select("access_level_id")
      .eq("permission_definition_id", permissionDefinition.id)
      .eq("effect", "allow")
      .limit(10000)

    if (existingError) {
      return NextResponse.json(
        { error: "Failed to load access control", message: existingError.message },
        { status: 500 }
      )
    }

    const allowedAccessLevelIds = new Set((existingRows || []).map((row) => row.access_level_id))
    const allowedAccessLevels = (accessLevels || [])
      .filter((level) => allowedAccessLevelIds.has(level.id))
      .map((level) => level.name)

    return NextResponse.json({ data: { accessLevels: accessLevels || [], allowedAccessLevels } })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load access control", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    await params

    const body = await request.json().catch(() => ({}))
    const allowedAccessLevelsRaw = Array.isArray(body.allowedAccessLevels)
      ? body.allowedAccessLevels
      : Array.isArray(body.allowedRoles)
        ? body.allowedRoles.map((role: string) => legacyRoleToAccessLevelMap[role] || role)
        : null

    if (!Array.isArray(allowedAccessLevelsRaw)) {
      return NextResponse.json({ error: "allowedAccessLevels must be an array" }, { status: 400 })
    }

    const allowedAccessLevels = Array.from(
      new Set(allowedAccessLevelsRaw.filter((value: unknown): value is string => typeof value === "string"))
    )

    const { data: allAccessLevels, error: allAccessLevelsError } = await adminSupabase
      .from("department_access_levels")
      .select("id, name")
      .eq("is_active", true)

    if (allAccessLevelsError || !allAccessLevels) {
      return NextResponse.json({ error: "Failed to load access levels" }, { status: 500 })
    }

    const validNames = new Set(allAccessLevels.map((level) => level.name))
    const invalid = allowedAccessLevels.filter((name) => !validNames.has(name))
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid department access level(s): ${invalid.join(", ")}` },
        { status: 400 }
      )
    }

    const { data: permissionDefinition } = await adminSupabase
      .from("permission_definitions")
      .select("id")
      .eq("resource", "department_questions")
      .eq("action", "answer")
      .single()

    if (!permissionDefinition?.id) {
      return NextResponse.json({ error: "Permission definition not found" }, { status: 500 })
    }

    const { data: existingRows, error: existingError } = await adminSupabase
      .from("department_access_level_permissions")
      .select("id, access_level_id")
      .in(
        "access_level_id",
        allAccessLevels.map((level) => level.id)
      )
      .eq("permission_definition_id", permissionDefinition.id)
      .eq("effect", "allow")
      .limit(10000)

    if (existingError) {
      return NextResponse.json(
        { error: "Failed to load existing grants", message: existingError.message },
        { status: 500 }
      )
    }

    const existingAccessLevelIds = new Set((existingRows || []).map((row) => row.access_level_id))
    const allowedAccessLevelIds = new Set(
      allAccessLevels.filter((level) => allowedAccessLevels.includes(level.name)).map((level) => level.id)
    )

    const toAdd = Array.from(allowedAccessLevelIds).filter((id) => !existingAccessLevelIds.has(id))
    const toRemove = (existingRows || [])
      .filter((row) => !allowedAccessLevelIds.has(row.access_level_id))
      .map((row) => row.id)

    if (toRemove.length > 0) {
      const { error: deleteError } = await adminSupabase
        .from("department_access_level_permissions")
        .delete()
        .in("id", toRemove)

      if (deleteError) {
        return NextResponse.json({ error: "Failed to remove grants", message: deleteError.message }, { status: 500 })
      }
    }

    if (toAdd.length > 0) {
      const { error: insertError } = await adminSupabase.from("department_access_level_permissions").insert(
        toAdd.map((accessLevelId) => ({
          access_level_id: accessLevelId,
          permission_definition_id: permissionDefinition.id,
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

    return NextResponse.json({ data: { allowedAccessLevels } })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update access control", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
