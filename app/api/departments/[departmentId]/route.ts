import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { adminSupabase } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const { departmentId } = await params

    if (!departmentId) {
      return NextResponse.json({ error: "Department ID is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check system-wide permissions first
    const { data: profile } = await adminSupabase
      .from("user_profiles")
      .select("role_id")
      .eq("user_id", user.id)
      .single()

    let systemWideAllowed = false
    if (profile) {
      const { data: permissions } = await adminSupabase
        .from("permissions")
        .select("resource, action")
        .eq("role_id", profile.role_id)

      const permissionNames = permissions?.map((p) => `${p.resource}.${p.action}`) || []
      systemWideAllowed =
        permissionNames.includes("departments.read") ||
        permissionNames.includes("departments.own.read") ||
        permissionNames.includes("admin.system")
    }

    // Check department access level membership (new architecture)
    const { data: accessLevel } = await supabase
      .from("user_department_access_levels")
      .select("id")
      .eq("user_id", user.id)
      .eq("department_id", departmentId)
      .maybeSingle()

    // Dual-layer resolution: department scope overrides system-wide
    // If user has access level in this department → ALLOW
    // Else fall back to system-wide permission
    const hasAccess = accessLevel !== null || systemWideAllowed

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Load department details
    const { data: dept, error: deptError } = await supabase
      .from("departments")
      .select("id, name, description, is_active")
      .eq("id", departmentId)
      .single()

    if (deptError || !dept) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 })
    }

    return NextResponse.json({ data: dept })
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

export async function PATCH(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const { departmentId } = await params

    if (!departmentId) {
      return NextResponse.json({ error: "Department ID is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description } = body

    if (name === undefined && description === undefined) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    // Check system-wide permissions first
    const { data: profile } = await adminSupabase
      .from("user_profiles")
      .select("role_id")
      .eq("user_id", user.id)
      .single()

    let systemWideAllowed = false
    if (profile) {
      const { data: permissions } = await adminSupabase
        .from("permissions")
        .select("resource, action")
        .eq("role_id", profile.role_id)

      const permissionNames = permissions?.map((p) => `${p.resource}.${p.action}`) || []
      systemWideAllowed =
        permissionNames.includes("departments.update") ||
        permissionNames.includes("admin.system")
    }

    // Check department access level membership
    const { data: userAccessLevel } = await adminSupabase
      .from("user_department_access_levels")
      .select("access_level_id")
      .eq("user_id", user.id)
      .eq("department_id", departmentId)
      .maybeSingle()

    let deptScopedAllowed = false
    if (userAccessLevel?.access_level_id) {
      const { data: accessLevelPermissions } = await adminSupabase
        .from("department_access_level_permissions")
        .select(`permission_definitions!inner(resource, action)`)
        .eq("access_level_id", userAccessLevel.access_level_id)
        .eq("effect", "allow")

      const accessLevelPermissionNames = accessLevelPermissions?.map((p) => {
        const pd = p.permission_definitions as { resource: string; action: string }
        return `${pd.resource}.${pd.action}`
      }) || []

      if (accessLevelPermissionNames.includes("departments.update")) {
        deptScopedAllowed = true
      }
    }

    if (!systemWideAllowed && !deptScopedAllowed) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Update department details
    const updates: Record<string, any> = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    updates.updated_at = new Date().toISOString()

    const { data: updatedDept, error: updateError } = await adminSupabase
      .from("departments")
      .update(updates)
      .eq("id", departmentId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: "Failed to update department", message: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ data: updatedDept })
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
