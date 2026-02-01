import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { departmentId } = await params

    if (!departmentId) {
      return NextResponse.json({ error: "Department ID is required" }, { status: 400 })
    }

    const { data: selfMembership, error: selfMembershipError } = await supabase
      .from("user_department_roles")
      .select("department_id")
      .eq("department_id", departmentId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()

    if (selfMembershipError) {
      return NextResponse.json(
        { error: "Failed to verify department membership", message: selfMembershipError.message },
        { status: 500 }
      )
    }

    if (!selfMembership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get all user_ids in this department
    // RLS on user_department_roles limits visibility:
    // - Contributor will only see their own membership row
    // - Others (lead/manager/supervisor/viewer) can see all members
    const { data: memberRows, error: membersError } = await supabase
      .from("user_department_roles")
      .select("user_id")
      .eq("department_id", departmentId)
      .eq("is_active", true)

    if (membersError) {
      return NextResponse.json(
        { error: "Failed to load department members", message: membersError.message },
        { status: 500 }
      )
    }

    const safeMemberRows = (memberRows ?? []) as Array<{ user_id: string }>
    const userIds = Array.from(new Set(safeMemberRows.map((r) => r.user_id)))

    if (userIds.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Fetch entries for those users.
    // RLS on captain_log_entries will enforce:
    // - self-only for contributors
    // - department-wide visibility for lead/manager/supervisor/viewer
    const { data: entries, error: entriesError } = await supabase
      .from("captain_log_entries")
      .select("*")
      .eq("department_id", departmentId)
      .in("user_id", userIds)
      .order("created_at", { ascending: false })

    if (entriesError) {
      return NextResponse.json({ error: "Failed to load entries", message: entriesError.message }, { status: 500 })
    }

    // Load custom responses for these entries (also protected by RLS)
    const safeEntries = (entries ?? []) as Array<{ id: string } & Record<string, unknown>>
    const entryIds = safeEntries.map((e) => e.id)

    if (entryIds.length === 0) {
      return NextResponse.json({ data: [] })
    }
    const { data: responses, error: responsesError } = await supabase
      .from("custom_responses")
      .select("*")
      .in("entry_id", entryIds)
      .order("timestamp")

    if (responsesError) {
      return NextResponse.json({ error: "Failed to load responses", message: responsesError.message }, { status: 500 })
    }

    const responsesMap = new Map<string, unknown[]>()
    ;(responses || []).forEach((r: unknown) => {
      if (!r || typeof r !== "object") return
      const rr = r as Record<string, unknown>
      const entryId = rr.entry_id
      if (typeof entryId !== "string" || !entryId) return
      const existing = responsesMap.get(entryId) || []
      existing.push(rr)
      responsesMap.set(entryId, existing)
    })

    const enriched = safeEntries.map((e: Record<string, unknown> & { id: string }) => ({
      ...e,
      custom_responses: responsesMap.get(e.id) || [],
    }))

    return NextResponse.json({ data: enriched })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
