import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ departmentId: string }> },
) {
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
        { status: 500 },
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
      return NextResponse.json(
        { error: "Failed to load entries", message: entriesError.message },
        { status: 500 },
      )
    }

    // Load custom responses for these entries (also protected by RLS)
    const safeEntries = (entries ?? []) as Array<{ id: string } & Record<string, any>>
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
      return NextResponse.json(
        { error: "Failed to load responses", message: responsesError.message },
        { status: 500 },
      )
    }

    const responsesMap = new Map<string, any[]>()
    ;(responses || []).forEach((r: any) => {
      const existing = responsesMap.get(r.entry_id) || []
      existing.push(r)
      responsesMap.set(r.entry_id, existing)
    })

    const enriched = safeEntries.map((e: any) => ({
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
      { status: 500 },
    )
  }
}
