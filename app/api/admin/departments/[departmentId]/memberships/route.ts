import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

function isSingleActiveMembershipViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const e = error as { code?: string; message?: string }
  if (e.code === "23505") return true
  if (typeof e.message === "string" && e.message.includes("user_department_professions_one_active_membership_per_user")) {
    return true
  }
  return false
}

async function buildActiveMembershipConflictResponse(userId: string) {
  type ActiveMembershipRow = {
    department_id: string | null
    department: {
      id: string | null
      name: string | null
    } | null
  }

  const { data: active, error } = await adminSupabase
    .from("user_department_professions")
    .select("department_id, department:departments(id, name)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      {
        error: "User already has an active department membership",
      },
      { status: 409 }
    )
  }

  const row = (active ?? null) as ActiveMembershipRow | null
  const deptName = row?.department?.name ?? undefined
  const deptId = row?.department_id ?? undefined

  return NextResponse.json(
    {
      error: "User already has an active department membership",
      message: deptName
        ? `User is already active in “${deptName}”. Deactivate it first or assign as inactive.`
        : undefined,
      details: deptId ? `Active department id: ${deptId}` : undefined,
    },
    { status: 409 }
  )
}

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

    const { data: memberships, error: membershipError } = await adminSupabase
      .from("user_department_professions")
      .select("id, user_id, department_id, role, is_active, created_at, updated_at")
      .eq("department_id", departmentId)
      .order("updated_at", { ascending: false })

    if (membershipError) {
      return NextResponse.json(
        { error: "Failed to load memberships", message: membershipError.message },
        { status: 500 }
      )
    }

    const userIds = Array.from(new Set((memberships || []).map((m) => m.user_id)))

    const { data: profiles, error: profilesError } = await adminSupabase
      .from("user_profiles")
      .select("user_id, name")
      .in("user_id", userIds)

    if (profilesError) {
      return NextResponse.json(
        { error: "Failed to load member profiles", message: profilesError.message },
        { status: 500 }
      )
    }

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]))

    const { data: listData, error: listError } = await adminSupabase.auth.admin.listUsers()
    if (listError) {
      return NextResponse.json({ error: "Failed to load member emails", message: listError.message }, { status: 500 })
    }

    const authMap = new Map((listData.users || []).map((u) => [u.id, u]))

    const enriched = (memberships || []).map((m) => {
      const profile = profileMap.get(m.user_id)
      const auth = authMap.get(m.user_id)
      return {
        ...m,
        user: {
          user_id: m.user_id,
          name: profile?.name || null,
          email: auth?.email || null,
        },
      }
    })

    return NextResponse.json({ data: enriched })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load memberships",
        message: error instanceof Error ? error.message : "Unknown error",
      },
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
    const role = body.role as string | undefined
    const is_active = (body.is_active as boolean | undefined) ?? true

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 })
    }

    const { data: existing, error: existingError } = await adminSupabase
      .from("user_department_professions")
      .select("id, role")
      .eq("department_id", departmentId)
      .eq("user_id", user_id)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ error: "Failed to load membership", message: existingError.message }, { status: 500 })
    }

    const nextRole = role ?? existing?.role
    if (!nextRole) {
      return NextResponse.json({ error: "role is required" }, { status: 400 })
    }

    const { data: roleRow, error: roleError } = await adminSupabase
      .from("department_professions")
      .select("key")
      .eq("key", nextRole)
      .eq("is_active", true)
      .maybeSingle()

    if (roleError) {
      return NextResponse.json({ error: "Failed to validate role", message: roleError.message }, { status: 500 })
    }

    if (!roleRow) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    if (is_active) {
      const { error: deactivateOtherMembershipsError } = await adminSupabase
        .from("user_department_professions")
        .update({
          is_active: false,
          updated_by: adminUserId,
          updated_at: new Date().toISOString(),
        })
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
    }

    if (!existing) {
      const { data: inserted, error: insertError } = await adminSupabase
        .from("user_department_professions")
        .insert({
          user_id,
          department_id: departmentId,
          role: nextRole,
          is_active,
          created_by: adminUserId,
          updated_by: adminUserId,
          updated_at: new Date().toISOString(),
        })
        .select("id, user_id, department_id, role, is_active, created_at, updated_at")
        .single()

      if (insertError) {
        if (isSingleActiveMembershipViolation(insertError)) {
          return await buildActiveMembershipConflictResponse(user_id)
        }
        return NextResponse.json({ error: "Failed to save membership", message: insertError.message }, { status: 500 })
      }

      return NextResponse.json({ data: inserted })
    }

    const { data: updated, error: updateError } = await adminSupabase
      .from("user_department_professions")
      .update({
        role: nextRole,
        is_active,
        updated_by: adminUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id, user_id, department_id, role, is_active, created_at, updated_at")
      .single()

    if (updateError) {
      if (isSingleActiveMembershipViolation(updateError)) {
        return await buildActiveMembershipConflictResponse(user_id)
      }
      return NextResponse.json({ error: "Failed to save membership", message: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to save membership",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
