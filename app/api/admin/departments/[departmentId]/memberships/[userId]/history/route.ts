import { NextRequest, NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import {
  MEMBERSHIP_HISTORY_PAGE_SIZE,
  buildMembershipHistorySummary,
  decodeMembershipHistoryCursor,
  encodeMembershipHistoryCursor,
  normalizeLegacyMembershipEvent,
  type LegacyMembershipAuditEvent,
} from "@/lib/memberships/history"
import { createClient } from "@/lib/supabase/server"
import { pickJoinedRow } from "@/lib/utils"

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ departmentId: string; userId: string }> }
) {
  try {
    const { isAdmin, error: authError } = await verifyAdmin()
    if (!isAdmin) {
      return createErrorResponse("PERMISSION_DENIED", authError || "Admin access required", {}, 403)
    }

    const { departmentId, userId } = await params
    const cursor = decodeMembershipHistoryCursor(request.nextUrl.searchParams.get("cursor"))

    const membershipQuery = adminSupabase
      .from("user_department_memberships")
      .select("is_active, is_primary, role:roles(display_name)")
      .eq("user_id", userId)
      .eq("department_id", departmentId)
      .order("is_primary", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)

    const eventsQuery = adminSupabase
      .from("membership_audit_log")
      .select(
        "id, action, reason, performed_by, created_at, role:roles(display_name), metadata"
      )
      .eq("user_id", userId)
      .or(`from_department_id.eq.${departmentId},to_department_id.eq.${departmentId}`)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(MEMBERSHIP_HISTORY_PAGE_SIZE + 1)

    if (cursor) {
      eventsQuery.or(`created_at.lt.${cursor.timestamp},and(created_at.eq.${cursor.timestamp},id.lt.${cursor.id})`)
    }

    const [{ data: membershipRows, error: membershipError }, { data: eventRows, error: eventsError }] = await Promise.all([
      membershipQuery,
      eventsQuery,
    ])

    if (membershipError) {
      return createErrorResponse("VALIDATION_ERROR", "Failed to load membership summary", {}, 500)
    }

    if (eventsError) {
      return createErrorResponse("VALIDATION_ERROR", "Failed to load history", {}, 500)
    }

    const pagedEvents = (eventRows || []).slice(0, MEMBERSHIP_HISTORY_PAGE_SIZE)
    const performerIds = Array.from(new Set(pagedEvents.map((event) => event.performed_by).filter(Boolean)))

    let performerMap = new Map<string, string>()
    if (performerIds.length > 0) {
      const { data: performers } = await adminSupabase.from("user_profiles").select("user_id, name").in("user_id", performerIds)
      performerMap = new Map((performers || []).map((performer) => [performer.user_id, performer.name || ""]))
    }

    const normalizedEvents = pagedEvents.map((event: any) => {
      const roleName = pickJoinedRow(event.role)?.display_name || null
      const metadata = event.metadata || {}
      
      return normalizeLegacyMembershipEvent({
        id: event.id,
        action: event.action,
        new_role: roleName,
        previous_role: metadata.previous_role || null, // Fallback if stored in metadata
        new_is_active: event.action === "activated" ? true : (event.action === "deactivated" ? false : undefined),
        new_is_primary: event.action === "primary_assigned" ? true : (event.action === "primary_removed" ? false : undefined),
        reason: event.reason,
        performed_by: event.performed_by,
        performed_at: event.created_at,
        performer_name: event.performed_by ? performerMap.get(event.performed_by) || null : null,
      })
    })

    const summaryRow = membershipRows?.[0]
    const summaryRole = summaryRow ? pickJoinedRow(summaryRow.role) : null
    
    const summary = buildMembershipHistorySummary(
      {
        isActive: summaryRow?.is_active ?? false,
        isPrimary: summaryRow?.is_primary ?? false,
        role: summaryRole?.display_name ?? null,
      },
      normalizedEvents[0] ?? null
    )

    const nextCursor =
      (eventRows || []).length > MEMBERSHIP_HISTORY_PAGE_SIZE
        ? encodeMembershipHistoryCursor(
            (pagedEvents[pagedEvents.length - 1]?.created_at as string) || new Date().toISOString(),
            pagedEvents[pagedEvents.length - 1]?.id
          )
        : undefined

    return NextResponse.json({
      summary,
      events: normalizedEvents,
      nextCursor,
    })
  } catch (error) {
    return createErrorResponse(
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "Failed to load history",
      {},
      500
    )
  }
}
