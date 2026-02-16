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

    // Option A: access level permissions are global (not department-scoped).
    // This endpoint remains for backward compatibility but returns the global catalog.
    const { data, error } = await adminSupabase
      .from("department_access_level_permissions")
      .select(
        `
        id,
        access_level_id,
        resource,
        action,
        effect,
        created_at,
        updated_at,
        department_access_levels (
          name,
          display_name,
          level
        )
      `
      )
      .order("resource", { ascending: true })
      .order("action", { ascending: true })
      .limit(10000)

    if (error) {
      return NextResponse.json(
        { error: "Failed to load department access level permissions", message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: data || [] })
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
