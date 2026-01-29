import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermissionFromRequest } from "@/lib/rbac/server"

export const dynamic = "force-dynamic"

type DepartmentRef = {
  id: string
  name: string | null
  is_active: boolean | null
}

type MembershipRow = {
  id: string
  user_id: string
  department_id: string
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
  department: DepartmentRef | null
}

type ProfessionRoleRef = {
  id: string
  name: string
  description: string | null
  department_id: string | null
  level: number | null
}

type ProfessionAssignmentRow = {
  id: string
  user_id: string
  department_id: string
  role_id: string
  is_active: boolean
  created_at: string
  updated_at: string
  role: ProfessionRoleRef | null
  department: DepartmentRef | null
}

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await verifyPermissionFromRequest(request, "admin.system")
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { userId } = await params
  const normalizedUserId = typeof userId === "string" ? userId.trim() : ""

  if (!normalizedUserId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  const [membershipsRes, professionsRes] = await Promise.all([
    adminSupabase
      .from("user_department_roles")
      .select(
        "id, user_id, department_id, role, is_active, created_at, updated_at, department:departments(id, name, is_active)"
      )
      .eq("user_id", normalizedUserId)
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false }),
    adminSupabase
      .from("user_department_professions")
      .select(
        "id, user_id, department_id, role_id, is_active, created_at, updated_at, department:departments(id, name, is_active), role:roles(id, name, description, department_id, level)"
      )
      .eq("user_id", normalizedUserId)
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false }),
  ])

  if (membershipsRes.error) {
    return NextResponse.json(
      { error: "Failed to load department memberships", message: membershipsRes.error.message },
      { status: 500 }
    )
  }

  if (professionsRes.error) {
    return NextResponse.json(
      { error: "Failed to load profession assignments", message: professionsRes.error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    data: {
      user_id: normalizedUserId,
      memberships: (membershipsRes.data || []) as unknown as MembershipRow[],
      profession_assignments: (professionsRes.data || []) as unknown as ProfessionAssignmentRow[],
    },
  })
}
