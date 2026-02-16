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
