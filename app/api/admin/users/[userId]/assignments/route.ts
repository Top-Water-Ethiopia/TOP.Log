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
  key: string
  label: string
  description: string | null
  department_id: string | null
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

  const { data: memberships, error: membershipsError } = await adminSupabase
    .from("user_department_memberships")
    .select(`
      id, 
      user_id, 
      department_id, 
      role_id, 
      membership_type,
      is_active, 
      is_primary,
      created_at, 
      updated_at, 
      department:departments(id, name, is_active),
      role:roles (
        id,
        name,
        display_name,
        type,
        description
      )
    `)
    .eq("user_id", normalizedUserId)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false })

  if (membershipsError) {
    return NextResponse.json(
      { error: "Failed to load department memberships", message: membershipsError.message },
      { status: 500 }
    )
  }

  const membershipRows = (memberships || []) as any[]

  return NextResponse.json({
    data: {
      user_id: normalizedUserId,
      memberships: membershipRows.map((m) => {
        const roleResult = Array.isArray(m.role) ? m.role[0] : m.role
        return {
          id: m.id,
          user_id: m.user_id,
          department_id: m.department_id,
          role: roleResult?.display_name || roleResult?.name || null,
          role_id: m.role_id,
          membership_type: m.membership_type,
          is_active: m.is_active,
          is_primary: m.is_primary,
          created_at: m.created_at,
          updated_at: m.updated_at,
          department: m.department,
        }
      }),
      profession_assignments: membershipRows
        .filter((m) => m.membership_type === "profession")
        .map((m) => {
          const roleResult = Array.isArray(m.role) ? m.role[0] : m.role
          return {
            id: m.id,
            user_id: m.user_id,
            department_id: m.department_id,
            role_id: m.role_id,
            is_active: m.is_active,
            created_at: m.created_at,
            updated_at: m.updated_at,
            role: roleResult
              ? {
                  id: roleResult.id,
                  key: roleResult.name,
                  label: roleResult.display_name,
                  description: roleResult.description,
                  department_id: m.department_id,
                }
              : null,
            department: m.department,
          }
        }),
    },
  })
}
