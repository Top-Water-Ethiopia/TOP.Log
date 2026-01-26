import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

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
      .from("user_department_professions")
      .select(
        "id, user_id, department_id, role_id, is_active, created_at, updated_at, role:roles(id, name, description, department_id, level)"
      )
      .eq("department_id", departmentId)
      .order("updated_at", { ascending: false })

    if (assignmentError) {
      return NextResponse.json(
        { error: "Failed to load assignments", message: assignmentError.message },
        { status: 500 }
      )
    }

    const userIds = Array.from(new Set((assignments || []).map((a) => a.user_id)))

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

    const enriched = (assignments || []).map((a) => {
      const profile = profileMap.get(a.user_id)
      const auth = authMap.get(a.user_id)
      return {
        ...a,
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
      .select("id, department_id")
      .eq("id", role_id)
      .maybeSingle()

    if (roleError) {
      return NextResponse.json({ error: "Failed to validate role", message: roleError.message }, { status: 500 })
    }

    if (!role || role.department_id !== departmentId) {
      return NextResponse.json({ error: "Invalid role selected" }, { status: 400 })
    }

    const nowIso = new Date().toISOString()

    type MembershipUpdate = Database["public"]["Tables"]["user_department_roles"]["Update"]
    type MembershipInsert = Database["public"]["Tables"]["user_department_roles"]["Insert"]
    type ProfessionUpdate = Database["public"]["Tables"]["user_department_professions"]["Update"]
    type ProfessionInsert = Database["public"]["Tables"]["user_department_professions"]["Insert"]

    if (is_active) {
      const deactivateMembershipsUpdate: MembershipUpdate = {
        is_active: false,
        updated_by: adminUserId,
        updated_at: nowIso,
      }

      const { error: deactivateOtherMembershipsError } = await adminSupabase
        .from("user_department_roles")
        .update(deactivateMembershipsUpdate)
        .eq("user_id", user_id)
        .neq("department_id", departmentId)
        .eq("is_active", true)

      if (deactivateOtherMembershipsError) {
        return NextResponse.json(
          {
            error: "Failed to deactivate other memberships",
            message: deactivateOtherMembershipsError.message,
          },
          { status: 500 }
        )
      }

      const deactivateProfessionsUpdate: ProfessionUpdate = {
        is_active: false,
        updated_by: adminUserId,
        updated_at: nowIso,
      }

      const { error: deactivateOtherProfessionsError } = await adminSupabase
        .from("user_department_professions")
        .update(deactivateProfessionsUpdate)
        .eq("user_id", user_id)
        .neq("department_id", departmentId)
        .eq("is_active", true)

      if (deactivateOtherProfessionsError) {
        return NextResponse.json(
          {
            error: "Failed to deactivate other profession assignments",
            message: deactivateOtherProfessionsError.message,
          },
          { status: 500 }
        )
      }
    }

    const { data: existingMembership, error: membershipError } = await adminSupabase
      .from("user_department_roles")
      .select("id, is_active")
      .eq("department_id", departmentId)
      .eq("user_id", user_id)
      .maybeSingle()

    if (membershipError) {
      return NextResponse.json(
        { error: "Failed to validate membership", message: membershipError.message },
        { status: 500 }
      )
    }

    if (!existingMembership) {
      const membershipInsert: MembershipInsert = {
        user_id,
        department_id: departmentId,
        role: "viewer",
        is_active: true,
        created_by: adminUserId,
        updated_by: adminUserId,
        updated_at: nowIso,
      }

      const { error: insertMembershipError } = await adminSupabase
        .from("user_department_roles")
        .insert(membershipInsert)

      if (insertMembershipError) {
        return NextResponse.json(
          { error: "Failed to ensure membership", message: insertMembershipError.message },
          { status: 500 }
        )
      }
    } else if (is_active && !existingMembership.is_active) {
      const reactivateMembershipUpdate: MembershipUpdate = {
        is_active: true,
        updated_by: adminUserId,
        updated_at: nowIso,
      }

      const { error: reactivateError } = await adminSupabase
        .from("user_department_roles")
        .update(reactivateMembershipUpdate)
        .eq("id", existingMembership.id)

      if (reactivateError) {
        return NextResponse.json(
          { error: "Failed to reactivate membership", message: reactivateError.message },
          { status: 500 }
        )
      }
    }

    const { data: existing, error: existingError } = await adminSupabase
      .from("user_department_professions")
      .select("id")
      .eq("department_id", departmentId)
      .eq("user_id", user_id)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ error: "Failed to load assignment", message: existingError.message }, { status: 500 })
    }

    if (!existing) {
      const professionInsert: ProfessionInsert = {
        user_id,
        department_id: departmentId,
        role_id,
        is_active,
        created_by: adminUserId,
        updated_by: adminUserId,
        updated_at: new Date().toISOString(),
      }

      const { data: inserted, error: insertError } = await adminSupabase
        .from("user_department_professions")
        .insert(professionInsert)
        .select("id, user_id, department_id, role_id, is_active, created_at, updated_at")
        .single()

      if (insertError) {
        return NextResponse.json({ error: "Failed to save assignment", message: insertError.message }, { status: 500 })
      }

      return NextResponse.json({ data: inserted })
    }

    const professionUpdate: ProfessionUpdate = {
      role_id,
      is_active,
      updated_by: adminUserId,
      updated_at: new Date().toISOString(),
    }

    const { data: updated, error: updateError } = await adminSupabase
      .from("user_department_professions")
      .update(professionUpdate)
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
