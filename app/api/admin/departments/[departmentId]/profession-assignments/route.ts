import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase.types"

export const dynamic = "force-dynamic"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { isAdmin: false as const, error: "Not authenticated" }
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role_id")
    .eq("user_id", user.id)
    .single()

  if (profileError || !profile) {
    return { isAdmin: false as const, error: "Admin access required" }
  }

  const isAdmin = profile.role_id === ADMIN_ROLE_ID || profile.role_id === SYSTEM_ADMIN_ROLE_ID

  if (!isAdmin) {
    return { isAdmin: false as const, error: "Admin access required" }
  }

  return { isAdmin: true as const, userId: user.id }
}

export async function GET(_request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const { isAdmin, error: authError } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Admin access required" }, { status: 403 })
    }

    const { departmentId } = await params

    const { data: assignments, error: assignmentError } = await adminSupabase
      .from("user_department_memberships")
      .select("id, user_id, department_id, role_id, membership_type, is_active, created_at, updated_at")
      .eq("department_id", departmentId)
      .eq("membership_type", "profession")
      .order("updated_at", { ascending: false })

    if (assignmentError) {
      return NextResponse.json(
        { error: "Failed to load assignments", message: assignmentError.message },
        { status: 500 }
      )
    }

    const assignmentRows = (assignments || []) as Array<{
      id: string
      user_id: string
      department_id: string
      role_id: string | null
      membership_type: string
      is_active: boolean
      created_at: string
      updated_at: string
    }>

    const userIds = Array.from(new Set(assignmentRows.map((a) => a.user_id)))

    const { data: profiles, error: profilesError } = await adminSupabase
      .from("user_profiles")
      .select("user_id, name")
      .in("user_id", userIds)

    if (profilesError) {
      return NextResponse.json(
        { error: "Failed to load user profiles", message: profilesError.message },
        { status: 500 }
      )
    }

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]))

    const { data: listData, error: listError } = await adminSupabase.auth.admin.listUsers()
    if (listError) {
      return NextResponse.json({ error: "Failed to load user emails", message: listError.message }, { status: 500 })
    }

    const authMap = new Map((listData.users || []).map((u) => [u.id, u]))

    const roleIds = Array.from(
      new Set(assignmentRows.map((row) => row.role_id).filter((id): id is string => typeof id === "string"))
    )

    const { data: roles, error: rolesError } =
      roleIds.length > 0
        ? await adminSupabase
            .from("roles")
            .select("id, name, display_name, description, department_id, type")
            .in("id", roleIds)
        : { data: [], error: null }

    if (rolesError) {
      return NextResponse.json(
        { error: "Failed to load roles", message: rolesError.message },
        { status: 500 }
      )
    }

    const roleById = new Map((roles || []).map((row) => [row.id, row]))

    const enriched = assignmentRows.map((a) => {
      const profile = profileMap.get(a.user_id)
      const auth = authMap.get(a.user_id)
      const role = a.role_id ? roleById.get(a.role_id) : null
      return {
        ...a,
        role_id: a.role_id,
        role: role
          ? {
              id: role.id,
              key: role.name,
              label: role.display_name,
              description: role.description,
              department_id: role.department_id,
              type: role.type,
            }
          : null,
        user: {
          user_id: a.user_id,
          name: profile?.name || null,
          email: auth?.email || null,
        },
      }
    })

    return NextResponse.json({ data: enriched })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load assignments", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const { isAdmin, error: authError, userId: adminUserId } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Admin access required" }, { status: 403 })
    }

    const { departmentId } = await params
    const body = await request.json().catch(() => ({}))

    const user_id = body.user_id as string | undefined
    const role_id = body.role_id as string | undefined
    const is_active = (body.is_active as boolean | undefined) ?? true

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 })
    }

    if (!role_id) {
      return NextResponse.json({ error: "role_id is required" }, { status: 400 })
    }

    const { data: role, error: roleError } = await adminSupabase
      .from("roles")
      .select("id, name, department_id, type")
      .eq("id", role_id)
      .maybeSingle()

    if (roleError) {
      return NextResponse.json({ error: "Failed to validate role", message: roleError.message }, { status: 500 })
    }

    if (!role || (role.department_id && role.department_id !== departmentId) || role.type !== "profession") {
      return NextResponse.json({ error: "Invalid role selected" }, { status: 400 })
    }

    const nowIso = new Date().toISOString()

    type MembershipUpdate = Database["public"]["Tables"]["user_department_memberships"]["Update"]
    type MembershipInsert = Database["public"]["Tables"]["user_department_memberships"]["Insert"]

    if (is_active) {
      const deactivateMembershipsUpdate: MembershipUpdate = {
        is_active: false,
        updated_by: adminUserId,
        updated_at: nowIso,
      }

      const { error: deactivateOtherMembershipsError } = await adminSupabase
        .from("user_department_memberships")
        .update(deactivateMembershipsUpdate)
        .eq("user_id", user_id)
        .neq("department_id", departmentId)
        .eq("membership_type", "profession")
        .eq("is_active", true)

      if (deactivateOtherMembershipsError) {
        return NextResponse.json(
          {
            error: "Failed to deactivate other profession assignments",
            message: deactivateOtherMembershipsError.message,
          },
          { status: 500 }
        )
      }
    }

    const { data: existing, error: existingError } = await adminSupabase
      .from("user_department_memberships")
      .select("id")
      .eq("department_id", departmentId)
      .eq("user_id", user_id)
      .eq("membership_type", "profession")
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ error: "Failed to load assignment", message: existingError.message }, { status: 500 })
    }

    if (!existing) {
      const membershipInsert: MembershipInsert = {
        user_id,
        department_id: departmentId,
        role_id: role_id,
        membership_type: "profession",
        is_active,
        created_by: adminUserId,
        updated_by: adminUserId,
        updated_at: new Date().toISOString(),
      }

      const { data: inserted, error: insertError } = await adminSupabase
        .from("user_department_memberships")
        .insert(membershipInsert)
        .select("id, user_id, department_id, role_id, is_active, created_at, updated_at")
        .single()

      if (insertError) {
        return NextResponse.json({ error: "Failed to save assignment", message: insertError.message }, { status: 500 })
      }

      return NextResponse.json({ data: inserted })
    }

    const membershipUpdate: MembershipUpdate = {
      role_id: role_id,
      is_active,
      updated_by: adminUserId,
      updated_at: new Date().toISOString(),
    }

    const { data: updated, error: updateError } = await adminSupabase
      .from("user_department_memberships")
      .update(membershipUpdate)
      .eq("id", existing.id)
      .select("id, user_id, department_id, role_id, is_active, created_at, updated_at")
      .single()

    if (updateError) {
      return NextResponse.json({ error: "Failed to save assignment", message: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save assignment", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
