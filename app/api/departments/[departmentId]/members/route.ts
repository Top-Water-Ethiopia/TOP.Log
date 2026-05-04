import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermissionForDepartmentFromRequest } from "@/lib/rbac/server"
import { pickJoinedRow } from "@/lib/utils"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
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

    const membersReadAuth = await verifyPermissionForDepartmentFromRequest(
      request,
      "departments.members.read",
      departmentId
    )
    const departmentsReadAuth = membersReadAuth.ok
      ? null
      : await verifyPermissionForDepartmentFromRequest(request, "departments.read", departmentId)

    if (!membersReadAuth.ok && !departmentsReadAuth?.ok) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { data: memberships, error: membershipError } = await adminSupabase
      .from("user_department_memberships")
      .select("user_id, is_active, role:roles(display_name)")
      .eq("department_id", departmentId)
      .eq("membership_type", "profession")
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

    const merged = (memberships || []).map((m) => {
      const role = pickJoinedRow(m.role)
      return {
        ...m,
        role: role?.display_name || null,
        profile: profileMap.get(m.user_id) || null,
      }
    })

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
