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

    const { data: accessLevels, error: accessLevelsError } = await adminSupabase
      .from("roles")
      .select("id, name, display_name, description, level, is_active")
      .eq("type", "access_level")
      .eq("is_active", true)
      .order("level", { ascending: false })

    if (accessLevelsError) {
      return NextResponse.json(
        { error: "Failed to load access levels", message: accessLevelsError.message },
        { status: 500 }
      )
    }

    const { data: existingRows, error: existingError } = await adminSupabase
      .from("role_permissions")
      .select("role_id")
      .eq("resource", "department_questions")
      .eq("action", "answer")
      .eq("effect", "allow")
      .limit(10000)

    if (existingError) {
      return NextResponse.json(
        { error: "Failed to load access control", message: existingError.message },
        { status: 500 }
      )
    }

    const allowedAccessLevelIds = new Set((existingRows || []).map((row) => row.role_id))
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
      .from("roles")
      .select("id, name")
      .eq("type", "access_level")
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

    const { data: existingRows, error: existingError } = await adminSupabase
      .from("role_permissions")
      .select("id, role_id")
      .in(
        "role_id",
        allAccessLevels.map((level) => level.id)
      )
      .eq("resource", "department_questions")
      .eq("action", "answer")
      .eq("effect", "allow")
      .limit(10000)

    if (existingError) {
      return NextResponse.json(
        { error: "Failed to load existing grants", message: existingError.message },
        { status: 500 }
      )
    }

    const existingAccessLevelIds = new Set((existingRows || []).map((row) => row.role_id))
    const allowedAccessLevelIds = new Set(
      allAccessLevels.filter((level) => allowedAccessLevels.includes(level.name)).map((level) => level.id)
    )

    const toAdd = Array.from(allowedAccessLevelIds).filter((id) => !existingAccessLevelIds.has(id))
    const toRemove = (existingRows || [])
      .filter((row) => !allowedAccessLevelIds.has(row.role_id))
      .map((row) => row.id)

    if (toRemove.length > 0) {
      const { error: deleteError } = await adminSupabase
        .from("role_permissions")
        .delete()
        .in("id", toRemove)

      if (deleteError) {
        return NextResponse.json({ error: "Failed to remove grants", message: deleteError.message }, { status: 500 })
      }
    }

    if (toAdd.length > 0) {
      const { error: insertError } = await adminSupabase.from("role_permissions").insert(
        toAdd.map((accessLevelId) => ({
          role_id: accessLevelId,
          resource: "department_questions",
          action: "answer",
          effect: "allow"
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
