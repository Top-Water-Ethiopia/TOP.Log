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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ departmentId: string; userId: string }> }
) {
  try {
    const { isAdmin, error: authError, userId: adminUserId } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Admin access required" }, { status: 403 })
    }

    const url = new URL(request.url)
    const hardDelete = url.searchParams.get("mode") === "hard"
    const { departmentId, userId } = await params

    const { data: memberships, error: membershipsError } = await adminSupabase
      .from("user_department_memberships")
      .select("id, user_id, department_id, membership_type, role_id, is_active, is_primary")
      .eq("department_id", departmentId)
      .eq("user_id", userId)

    if (membershipsError) {
      return NextResponse.json(
        { error: "Failed to load membership", message: membershipsError.message },
        { status: 500 }
      )
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ data: null })
    }

    if (hardDelete) {
      await adminSupabase.from("membership_audit_log").insert(
        memberships.map((membership) => ({
          user_id: membership.user_id,
          from_department_id: departmentId,
          membership_type: membership.membership_type,
          role_id: membership.role_id,
          action: "deactivated",
          reason: "Hard delete requested",
          performed_by: adminUserId,
          metadata: { previous_state: membership, hard_delete: true },
        }))
      )

      const { error: deleteError } = await adminSupabase
        .from("user_department_memberships")
        .delete()
        .in(
          "id",
          memberships.map((membership) => membership.id)
        )

      if (deleteError) {
        return NextResponse.json(
          { error: "Failed to permanently delete membership", message: deleteError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ data: { deleted: true } })
    }

    const nowIso = new Date().toISOString()

    const { error: deactivateError } = await adminSupabase
      .from("user_department_memberships")
      .update({
        is_active: false,
        deactivated_at: nowIso,
        updated_by: adminUserId,
        updated_at: nowIso,
      })
      .eq("department_id", departmentId)
      .eq("user_id", userId)

    if (deactivateError) {
      return NextResponse.json(
        { error: "Failed to remove membership", message: deactivateError.message },
        { status: 500 }
      )
    }

    await adminSupabase.from("membership_audit_log").insert(
      memberships.map((membership) => ({
        user_id: membership.user_id,
        from_department_id: departmentId,
        membership_type: membership.membership_type,
        role_id: membership.role_id,
        action: "deactivated",
        performed_by: adminUserId,
      }))
    )

    return NextResponse.json({ data: { deactivated: true } })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to remove membership",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
