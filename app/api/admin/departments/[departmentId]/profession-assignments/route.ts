import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"
const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { isAdmin: false as const, isSuperAdmin: false as const, error: "Not authenticated" }
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role_id")
    .eq("user_id", user.id)
    .single()

  if (profileError || !profile) {
    return { isAdmin: false as const, isSuperAdmin: false as const, error: "Admin access required" }
  }

  const isSuperAdmin = profile.role_id === SUPER_ADMIN_ROLE_ID
  const isAdmin = profile.role_id === ADMIN_ROLE_ID || profile.role_id === SYSTEM_ADMIN_ROLE_ID || isSuperAdmin

  if (!isAdmin) {
    return { isAdmin: false as const, isSuperAdmin: false as const, error: "Admin access required" }
  }

  return { isAdmin: true as const, isSuperAdmin, userId: user.id }
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
        "id, user_id, department_id, role_id, is_active, created_at, updated_at, role:roles(id, name, description, department_id, level)",
      )
      .eq("department_id", departmentId)
      .order("updated_at", { ascending: false })

    if (assignmentError) {
      return NextResponse.json(
        { error: "Failed to load assignments", message: assignmentError.message },
        { status: 500 },
      )
    }

    const userIds = Array.from(new Set((assignments || []).map((a) => a.user_id)))

    const { data: profiles, error: profilesError } = await adminSupabase
      .from("user_profiles")
      .select("user_id, name")
      .in("user_id", userIds)

    if (profilesError) {
      return NextResponse.json({ error: "Failed to load user profiles", message: profilesError.message }, { status: 500 })
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
      { status: 500 },
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
      const { data: inserted, error: insertError } = await adminSupabase
        .from("user_department_professions")
        .insert({
          user_id,
          department_id: departmentId,
          role_id,
          is_active,
          created_by: adminUserId,
          updated_by: adminUserId,
          updated_at: new Date().toISOString(),
        } as any)
        .select("id, user_id, department_id, role_id, is_active, created_at, updated_at")
        .single()

      if (insertError) {
        return NextResponse.json({ error: "Failed to save assignment", message: insertError.message }, { status: 500 })
      }

      return NextResponse.json({ data: inserted })
    }

    const { data: updated, error: updateError } = await adminSupabase
      .from("user_department_professions")
      .update({
        role_id,
        is_active,
        updated_by: adminUserId,
        updated_at: new Date().toISOString(),
      } as any)
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
      { status: 500 },
    )
  }
}
