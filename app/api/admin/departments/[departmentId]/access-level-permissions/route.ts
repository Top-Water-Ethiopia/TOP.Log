import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermissionFromRequest } from "@/lib/rbac/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { departmentId } = await params
    if (!departmentId) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 })
    }

    // Access level permissions are now managed via role_permissions (global).
    const { data, error } = await adminSupabase
      .from("role_permissions")
      .select(
        `
        id,
        role_id,
        permission_definitions!inner (
          id,
          resource,
          action
        ),
        roles!inner (
          name,
          display_name
        )
      `
      )
      .eq("roles.type", "access_level")
      .order("permission_definitions(resource)", { ascending: true })
      .order("permission_definitions(action)", { ascending: true })
      .limit(10000)

    if (error) {
      return NextResponse.json(
        { error: "Failed to load role permissions", message: error.message },
        { status: 500 }
      )
    }

    const transformed = (data || []).map((p: any) => ({
      id: p.id,
      access_level_id: p.role_id,
      resource: p.permission_definitions?.resource,
      action: p.permission_definitions?.action,
      effect: "allow",
      department_access_levels: p.roles
    }))

    return NextResponse.json({ data: transformed })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load department access level permissions",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
