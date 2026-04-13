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
  if (
    typeof e.message === "string" &&
    e.message.includes("user_department_memberships_one_active_profession_per_user")
  ) {
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

  // Query unified membership table for active profession membership
  const { data: active, error } = await adminSupabase
    .from("user_department_memberships")
    .select("department_id, department:departments(id, name)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("membership_type", "profession")
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
        ? `User is already active in "${deptName}". Deactivate it first or assign as inactive.`
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

    // Fetch unified memberships (professions + access levels)
    const { data: memberships, error: membershipsError } = await adminSupabase
      .from("user_department_memberships")
      .select(
        `
        id,
        user_id,
        department_id,
        membership_type,
        role_id,
        is_active,
        is_primary,
        last_used_at,
        created_at,
        updated_at,
        role:roles!inner(
          id,
          type,
          name,
          display_name,
          level
        )
      `
      )
      .eq("department_id", departmentId)
      .order("updated_at", { ascending: false })

    if (membershipsError) {
      return NextResponse.json(
        { error: "Failed to load memberships", message: membershipsError.message },
        { status: 500 }
      )
    }

    const userIds = Array.from(new Set(memberships.map((m) => m.user_id)))

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

// Helper: Standard error response
function createErrorResponse(
  code: "CONFLICT" | "PERMISSION_DENIED" | "VALIDATION_ERROR" | "NOT_FOUND" | "CONCURRENT_MODIFICATION",
  message: string,
  details?: Record<string, unknown>,
  status: number = 400
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      },
    },
    { status }
  )
}

// Helper: Update membership with primary handling via RPC
async function updateMembershipWithPrimary(
  departmentId: string,
  userId: string,
  updates: {
    role?: string
    is_active?: boolean
    is_primary?: boolean
    reason?: string
  },
  adminUserId: string,
  lastUpdatedAt?: string
) {
  // Optimistic locking check
  if (lastUpdatedAt) {
    const { data: current } = await adminSupabase
      .from("user_department_memberships")
      .select("updated_at")
      .eq("department_id", departmentId)
      .eq("user_id", userId)
      .eq("membership_type", "profession")
      .single()

    if (current && new Date(current.updated_at).getTime() !== new Date(lastUpdatedAt).getTime()) {
      return { error: "CONCURRENT_MODIFICATION", status: 409 }
    }
  }

  // Use RPC for atomic primary handling (type assertion needed until types regenerated)
  const { data, error } = await (adminSupabase.rpc as any)("update_membership_with_primary", {
    p_department_id: departmentId,
    p_user_id: userId,
    p_updates: updates,
    p_performed_by: adminUserId,
    p_reason: updates.reason || null,
  })

  if (error) {
    if (error.message?.includes("user_department_memberships_one_active_profession_per_user")) {
      return { error: "CONFLICT", status: 409 }
    }
    return { error: "VALIDATION_ERROR", message: error.message, status: 500 }
  }

  return { data, status: 200 }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const { isAdmin, error: authError, userId: adminUserId } = await verifyAdmin()
    if (!isAdmin) {
      return createErrorResponse("PERMISSION_DENIED", authError || "Admin access required", {}, 403)
    }

    const { departmentId } = await params
    const body = await request.json().catch(() => ({}))
    const { membership_id, user_id, is_active, role, is_primary, reason, last_updated_at } = body

    if (!membership_id && !user_id) {
      return createErrorResponse("VALIDATION_ERROR", "membership_id or user_id is required", {}, 400)
    }

    if (membership_id) {
      const { data: membership, error: membershipError } = await adminSupabase
        .from("user_department_memberships")
        .select("id, user_id, department_id, membership_type, role_id, is_active, is_primary, updated_at")
        .eq("id", membership_id)
        .eq("department_id", departmentId)
        .single()

      if (membershipError || !membership) {
        return createErrorResponse("NOT_FOUND", "Membership not found", {}, 404)
      }

      if (last_updated_at && new Date(membership.updated_at).getTime() !== new Date(last_updated_at).getTime()) {
        return createErrorResponse(
          "CONCURRENT_MODIFICATION",
          "Record modified by another user. Please refresh and try again.",
          {},
          409
        )
      }

      const nextUpdatedAt = new Date().toISOString()
      const nextIsActive = typeof is_active === "boolean" ? is_active : membership.is_active
      const nextIsPrimary = typeof is_primary === "boolean" ? is_primary : membership.is_primary

      if (typeof is_primary === "boolean" && is_primary) {
        const { error: clearPrimaryError } = await adminSupabase
          .from("user_department_memberships")
          .update({
            is_primary: false,
            updated_by: adminUserId,
            updated_at: nextUpdatedAt,
          })
          .eq("user_id", membership.user_id)
          .eq("is_primary", true)
          .neq("id", membership.id)

        if (clearPrimaryError) {
          return createErrorResponse("VALIDATION_ERROR", clearPrimaryError.message, {}, 500)
        }
      }

      const updatePayload: {
        is_active?: boolean
        is_primary?: boolean
        updated_by: string
        updated_at: string
        deactivated_at?: string | null
      } = {
        updated_by: adminUserId,
        updated_at: nextUpdatedAt,
      }

      if (typeof is_active === "boolean") {
        updatePayload.is_active = is_active
        updatePayload.deactivated_at = is_active ? null : nextUpdatedAt
        // Constraint: chk_primary_must_be_active. Any inactive membership must not be primary.
        if (!is_active) {
          updatePayload.is_primary = false
        }
      }

      if (typeof is_primary === "boolean" && !updatePayload.hasOwnProperty("is_primary")) {
        updatePayload.is_primary = nextIsPrimary
      }

      const { data: updatedMembership, error: updateError } = await adminSupabase
        .from("user_department_memberships")
        .update(updatePayload)
        .eq("id", membership.id)
        .select(
          `
          id,
          user_id,
          department_id,
          membership_type,
          role_id,
          is_active,
          is_primary,
          created_at,
          updated_at,
          role:roles!inner(
            id,
            type,
            name,
            display_name,
            level
          )
        `
        )
        .single()

      if (updateError) {
        return createErrorResponse("VALIDATION_ERROR", updateError.message, {}, 500)
      }

      if (typeof is_active === "boolean" && membership.is_active !== nextIsActive) {
        await adminSupabase.from("membership_audit_log").insert({
          user_id: membership.user_id,
          from_department_id: departmentId,
          membership_type: membership.membership_type,
          role_id: membership.role_id,
          action: nextIsActive ? "activated" : "deactivated",
          reason: reason || null,
          performed_by: adminUserId,
        })
      }

      if (typeof is_primary === "boolean" && membership.is_primary !== nextIsPrimary) {
        if (membership.is_primary && !nextIsPrimary) {
          await adminSupabase.from("membership_audit_log").insert({
            user_id: membership.user_id,
            from_department_id: departmentId,
            membership_type: membership.membership_type,
            role_id: membership.role_id,
            action: "primary_removed",
            reason: reason || null,
            performed_by: adminUserId,
          })
        }

        if (nextIsPrimary) {
          await adminSupabase.from("membership_audit_log").insert({
            user_id: membership.user_id,
            to_department_id: departmentId,
            membership_type: membership.membership_type,
            role_id: membership.role_id,
            action: "primary_assigned",
            reason: reason || null,
            performed_by: adminUserId,
          })
        }
      }

      return NextResponse.json({ data: updatedMembership })
    }

    const result = await updateMembershipWithPrimary(
      departmentId,
      user_id,
      { role, is_active, is_primary, reason },
      adminUserId,
      last_updated_at
    )

    if (result.error) {
      if (result.error === "CONCURRENT_MODIFICATION") {
        return createErrorResponse(
          "CONCURRENT_MODIFICATION",
          "Record modified by another user. Please refresh and try again.",
          {},
          409
        )
      }
      if (result.error === "CONFLICT") {
        return await buildActiveMembershipConflictResponse(user_id)
      }
      return createErrorResponse(
        result.error as "CONFLICT" | "PERMISSION_DENIED" | "VALIDATION_ERROR" | "NOT_FOUND" | "CONCURRENT_MODIFICATION",
        result.message || "Failed to update membership",
        {},
        result.status || 500
      )
    }

    return NextResponse.json({ data: result.data })
  } catch (error) {
    return createErrorResponse(
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "Failed to update membership",
      {},
      500
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

    const action = body.action as string | undefined

    // Handle 'move' action separately
    if (action === "move") {
      const { user_id, target_department_id, new_role, reason, last_updated_at } = body

      if (!user_id) {
        return NextResponse.json({ error: "user_id is required" }, { status: 400 })
      }

      if (!target_department_id) {
        return NextResponse.json({ error: "target_department_id is required" }, { status: 400 })
      }

      if (!new_role) {
        return NextResponse.json({ error: "new_role is required" }, { status: 400 })
      }

      // Get the membership being moved to determine role_id and membership_type
      const { data: sourceMembership, error: sourceError } = await adminSupabase
        .from("user_department_memberships")
        .select("id, role_id, membership_type, is_primary, updated_at")
        .eq("department_id", departmentId)
        .eq("user_id", user_id)
        .eq("is_active", true)
        .single()

      if (sourceError || !sourceMembership) {
        return NextResponse.json({ error: "Source membership not found" }, { status: 404 })
      }

      // Optimistic locking check
      if (last_updated_at && new Date(sourceMembership.updated_at).getTime() !== new Date(last_updated_at).getTime()) {
        return NextResponse.json(
          { error: "Record modified by another user. Please refresh and try again." },
          { status: 409 }
        )
      }

      // Use RPC for atomic move operation
      const { data, error } = await (adminSupabase.rpc as any)("move_member_atomic", {
        p_user_id: user_id,
        p_from_department_id: departmentId,
        p_to_department_id: target_department_id,
        p_membership_type: sourceMembership.membership_type,
        p_role_id: new_role || sourceMembership.role_id,
        p_is_primary: sourceMembership.is_primary,
        p_performed_by: adminUserId,
        p_reason: reason || null,
      })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ data })
    }

    // Original POST logic for create/activate - now using unified memberships
    const user_id = body.user_id as string | undefined
    const role_id = body.role_id as string | undefined
    const membership_type = (body.membership_type as "profession" | "access_level" | undefined) ?? "profession"
    const is_active = (body.is_active as boolean | undefined) ?? true

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 })
    }

    if (!role_id) {
      return NextResponse.json({ error: "role_id is required" }, { status: 400 })
    }

    // Validate role exists and matches membership_type
    const { data: roleData, error: roleError } = await adminSupabase
      .from("roles")
      .select("id, type, is_active")
      .eq("id", role_id)
      .single()

    if (roleError || !roleData) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    if (roleData.type !== membership_type) {
      return NextResponse.json(
        { error: "Role type mismatch: role.type does not match membership_type" },
        { status: 400 }
      )
    }

    // Check for existing membership
    const { data: existing, error: existingError } = await adminSupabase
      .from("user_department_memberships")
      .select("id, role_id, is_active")
      .eq("department_id", departmentId)
      .eq("user_id", user_id)
      .eq("membership_type", membership_type)
      .eq("role_id", role_id)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ error: "Failed to load membership", message: existingError.message }, { status: 500 })
    }

    if (!existing) {
      // Create new membership
      const { data: inserted, error: insertError } = await adminSupabase
        .from("user_department_memberships")
        .insert({
          user_id,
          department_id: departmentId,
          membership_type,
          role_id,
          is_active,
          created_by: adminUserId,
          updated_by: adminUserId,
        })
        .select("id, user_id, department_id, membership_type, role_id, is_active, is_primary, created_at, updated_at")
        .single()

      if (insertError) {
        return NextResponse.json(
          { error: "Failed to create membership", message: insertError.message },
          { status: 500 }
        )
      }

      // Log creation
      await adminSupabase.from("membership_audit_log").insert({
        user_id,
        to_department_id: departmentId,
        membership_type,
        role_id,
        action: "created",
        performed_by: adminUserId,
      })

      return NextResponse.json({ data: inserted })
    }

    // Update existing membership
    const { data: updated, error: updateError } = await adminSupabase
      .from("user_department_memberships")
      .update({
        is_active,
        updated_by: adminUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id, user_id, department_id, membership_type, role_id, is_active, is_primary, created_at, updated_at")
      .single()

    if (updateError) {
      return NextResponse.json({ error: "Failed to update membership", message: updateError.message }, { status: 500 })
    }

    // Log activation/deactivation
    await adminSupabase.from("membership_audit_log").insert({
      user_id,
      to_department_id: departmentId,
      membership_type,
      role_id,
      action: is_active ? "activated" : "deactivated",
      performed_by: adminUserId,
    })

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

export async function DELETE(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const { isAdmin, error: authError, userId: adminUserId } = await verifyAdmin()
    if (!isAdmin) {
      return createErrorResponse("PERMISSION_DENIED", authError || "Admin access required", {}, 403)
    }

    const { departmentId } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const confirm = searchParams.get("confirm")

    if (!userId) {
      return createErrorResponse("VALIDATION_ERROR", "userId is required", {}, 400)
    }

    if (confirm !== "true") {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Hard delete requires confirmation. Add ?confirm=true to proceed.",
        {},
        400
      )
    }

    // Get membership data for audit before delete
    const { data: membership, error: fetchError } = await adminSupabase
      .from("user_department_memberships")
      .select("id, user_id, department_id, membership_type, role_id, is_active, is_primary")
      .eq("department_id", departmentId)
      .eq("user_id", userId)
      .single()

    if (fetchError) {
      return createErrorResponse("NOT_FOUND", "Membership not found", {}, 404)
    }

    // Log to audit log before deletion
    await adminSupabase.from("membership_audit_log").insert({
      user_id: userId,
      from_department_id: departmentId,
      membership_type: membership.membership_type,
      role_id: membership.role_id,
      action: "deactivated", // Soft delete = deactivate
      reason: "Hard delete requested",
      performed_by: adminUserId,
      metadata: { previous_state: membership, hard_delete: true },
    })

    // Soft delete: deactivate instead of hard delete
    const { error: deleteError } = await adminSupabase
      .from("user_department_memberships")
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        updated_by: adminUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", membership.id)

    if (deleteError) {
      return createErrorResponse("VALIDATION_ERROR", deleteError.message, {}, 500)
    }

    return NextResponse.json({ success: true, message: "Membership permanently deleted" })
  } catch (error) {
    return createErrorResponse(
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "Failed to delete membership",
      {},
      500
    )
  }
}
