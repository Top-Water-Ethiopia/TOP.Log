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

  const isSuperAdmin = profile.role_id === SUPER_ADMIN_ROLE_ID
  const isAdmin = profile.role_id === ADMIN_ROLE_ID || profile.role_id === SYSTEM_ADMIN_ROLE_ID || isSuperAdmin

  if (!isAdmin) {
    return { isAdmin: false as const, error: "Admin access required" }
  }

  return { isAdmin: true as const, isSuperAdmin, userId: user.id }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ departmentId: string; userId: string }> },
) {
  try {
    const { isAdmin, isSuperAdmin, error: authError, userId: adminUserId } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Admin access required" }, { status: 403 })
    }

    const url = new URL(request.url)
    const mode = url.searchParams.get("mode")
    const hardDelete = mode === "hard"

    if (hardDelete && !isSuperAdmin) {
      return NextResponse.json({ error: "Super admin access required" }, { status: 403 })
    }

    const { departmentId, userId } = await params

    const { data: existing, error: existingError } = await adminSupabase
      .from("user_department_roles")
      .select("id")
      .eq("department_id", departmentId)
      .eq("user_id", userId)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json(
        { error: "Failed to load membership", message: existingError.message },
        { status: 500 },
      )
    }

    if (!existing) {
      return NextResponse.json({ data: null })
    }

    if (hardDelete) {
      const { error } = await adminSupabase.from("user_department_roles").delete().eq("id", existing.id)

      if (error) {
        return NextResponse.json({ error: "Failed to permanently delete membership", message: error.message }, { status: 500 })
      }

      const { error: professionDeleteError } = await adminSupabase
        .from("user_department_professions")
        .delete()
        .eq("department_id", departmentId)
        .eq("user_id", userId)

      if (professionDeleteError) {
        return NextResponse.json(
          { error: "Failed to permanently delete profession assignment", message: professionDeleteError.message },
          { status: 500 },
        )
      }

      return NextResponse.json({ data: { deleted: true } })
    }

    const { data, error } = await adminSupabase
      .from("user_department_roles")
      .update({
        is_active: false,
        updated_by: adminUserId,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", existing.id)
      .select("id, user_id, department_id, role, is_active, created_at, updated_at")
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to remove membership", message: error.message }, { status: 500 })
    }

    const nowIso = new Date().toISOString()
    const { error: professionDeactivateError } = await adminSupabase
      .from("user_department_professions")
      .update({
        is_active: false,
        updated_by: adminUserId,
        updated_at: nowIso,
      } as any)
      .eq("department_id", departmentId)
      .eq("user_id", userId)

    if (professionDeactivateError) {
      return NextResponse.json(
        { error: "Failed to remove profession assignment", message: professionDeactivateError.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to remove membership",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
