import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { adminSupabase } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { departmentId } = await params

    if (!departmentId) {
      return NextResponse.json({ error: "Department ID is required" }, { status: 400 })
    }

    // --- ACCESS CONTROL START ---
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
        permissionNames.includes("departments.members.read") ||
        permissionNames.includes("departments.read") ||
        permissionNames.includes("admin.system")
    }

    // Check department-scoped access levels
    const { data: accessLevel } = await adminSupabase
      .from("user_department_access_levels")
      .select("id")
      .eq("user_id", user.id)
      .eq("department_id", departmentId)
      .maybeSingle()

    // Also check if they are in user_department_professions as a fallback for legacy compatibility
    const { data: roleMembership } = await adminSupabase
      .from("user_department_professions")
      .select("id")
      .eq("user_id", user.id)
      .eq("department_id", departmentId)
      .eq("is_active", true)
      .maybeSingle()

    const hasAccess = systemWideAllowed || accessLevel !== null || roleMembership !== null

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    // --- ACCESS CONTROL END ---

    const { data: memberships, error: membershipError } = await adminSupabase
      .from("user_department_professions")
      .select("user_id, role, is_active")
      .eq("department_id", departmentId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })

    if (membershipError) {
      return NextResponse.json({ error: "Failed to load members", message: membershipError.message }, { status: 500 })
    }

    const userIds = Array.from(new Set((memberships || []).map((m) => m.user_id)))

    const { data: profiles, error: profilesError } = await adminSupabase
      .from("user_profiles")
      .select("user_id, name, role_id, department_id, is_active")
      .in("user_id", userIds)

    if (profilesError) {
      return NextResponse.json(
        { error: "Failed to load member profiles", message: profilesError.message },
        { status: 500 }
      )
    }

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]))

    const merged = (memberships || []).map((m) => ({
      ...m,
      profile: profileMap.get(m.user_id) || null,
    }))

    return NextResponse.json({ data: merged })
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
