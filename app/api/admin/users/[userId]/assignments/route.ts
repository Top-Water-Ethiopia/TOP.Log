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

  const [membershipsRes, professionsRes] = await Promise.all([
    adminSupabase
      .from("user_department_professions")
      .select(
        "id, user_id, department_id, role, is_active, created_at, updated_at, department:departments(id, name, is_active)"
      )
      .eq("user_id", normalizedUserId)
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false }),
    adminSupabase
      .from("user_department_professions")
      .select("id, user_id, department_id, department_role_id, role, is_active, created_at, updated_at, department:departments(id, name, is_active)")
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

  const professionRows = (professionsRes.data || []) as Array<{
    id: string
    user_id: string
    department_id: string
    department_role_id: string | null
    role: string | null
    is_active: boolean
    created_at: string
    updated_at: string
    department: DepartmentRef | null
  }>

  const professionIds = Array.from(
    new Set(professionRows.map((row) => row.department_role_id).filter((id): id is string => typeof id === "string"))
  )
  const professionKeys = Array.from(
    new Set(professionRows.map((row) => row.role).filter((key): key is string => typeof key === "string" && !!key))
  )

  const professionFilters = [
    professionIds.length > 0 ? `id.in.(${professionIds.join(",")})` : null,
    professionKeys.length > 0 ? `key.in.(${professionKeys.join(",")})` : null,
  ].filter(Boolean)

  const { data: professionDefs, error: professionDefsError } =
    professionFilters.length > 0
      ? await adminSupabase
          .from("department_professions")
          .select("id, key, label, description, department_id")
          .or(professionFilters.join(","))
      : { data: [], error: null }

  if (professionDefsError) {
    return NextResponse.json(
      { error: "Failed to load profession definitions", message: professionDefsError.message },
      { status: 500 }
    )
  }

  const professionById = new Map((professionDefs || []).map((row) => [row.id, row]))
  const professionByKey = new Map((professionDefs || []).map((row) => [row.key, row]))

  return NextResponse.json({
    data: {
      user_id: normalizedUserId,
      memberships: (membershipsRes.data || []) as unknown as MembershipRow[],
      profession_assignments: professionRows.map((row) => {
        const profession =
          (row.department_role_id ? professionById.get(row.department_role_id) : null) ||
          (row.role ? professionByKey.get(row.role) : null) ||
          null

        return {
          id: row.id,
          user_id: row.user_id,
          department_id: row.department_id,
          role_id: row.department_role_id || "",
          is_active: row.is_active,
          created_at: row.created_at,
          updated_at: row.updated_at,
          role: profession
            ? {
                id: profession.id,
                key: profession.key,
                label: profession.label,
                description: profession.description,
                department_id: profession.department_id,
              }
            : null,
          department: row.department,
        }
      }) as ProfessionAssignmentRow[],
    },
  })
}
