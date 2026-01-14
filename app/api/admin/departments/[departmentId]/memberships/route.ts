import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

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

    const { data: memberships, error: membershipError } = await adminSupabase
      .from("user_department_roles")
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

    const allowedRoles = new Set(["department_lead", "department_manager", "supervisor", "contributor", "viewer"])

    const { data: existing, error: existingError } = await adminSupabase
      .from("user_department_roles")
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
    if (!allowedRoles.has(nextRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    if (!existing) {
      const { data: inserted, error: insertError } = await adminSupabase
        .from("user_department_roles")
        .insert({
          user_id,
          department_id: departmentId,
          role: nextRole,
          is_active,
          created_by: adminUserId,
          updated_by: adminUserId,
          updated_at: new Date().toISOString(),
        } as any)
        .select("id, user_id, department_id, role, is_active, created_at, updated_at")
        .single()

      if (insertError) {
        return NextResponse.json({ error: "Failed to save membership", message: insertError.message }, { status: 500 })
      }

      return NextResponse.json({ data: inserted })
    }

    const { data: updated, error: updateError } = await adminSupabase
      .from("user_department_roles")
      .update({
        role: nextRole,
        is_active,
        updated_by: adminUserId,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", existing.id)
      .select("id, user_id, department_id, role, is_active, created_at, updated_at")
      .single()

    if (updateError) {
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
