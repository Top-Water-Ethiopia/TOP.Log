import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { adminSupabase } from "@/lib/supabase/admin"

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

    // --- ACCESS CONTROL START ---
    // Check system-wide permissions first
    const { data: profile } = await adminSupabase
      .from("user_profiles")
      .select("role_id")
      .eq("user_id", user.id)
      .single()

    let systemWideAllowed = false
    if (profile) {
      const { data: permissions } = await adminSupabase
        .from("permissions")
        .select("resource, action")
        .eq("role_id", profile.role_id)

      const permissionNames = permissions?.map((p) => `${p.resource}.${p.action}`) || []
      systemWideAllowed =
        permissionNames.includes("departments.members.read") ||
        permissionNames.includes("departments.read") ||
        permissionNames.includes("admin.system")
    }

    // Check department-scoped access levels
    const { data: accessLevel } = await adminSupabase
      .from("user_department_access_levels")
      .select("id")
      .eq("user_id", user.id)
      .eq("department_id", departmentId)
      .maybeSingle()

    // Also check if they are in user_department_professions as a fallback for legacy compatibility
    const { data: roleMembership } = await adminSupabase
      .from("user_department_professions")
      .select("id")
      .eq("user_id", user.id)
      .eq("department_id", departmentId)
      .eq("is_active", true)
      .maybeSingle()

    const hasAccess = systemWideAllowed || accessLevel !== null || roleMembership !== null

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    // --- ACCESS CONTROL END ---

    // Fetch entries that represent this department.
    // New rows use subject_department_id; the migration backfills legacy rows.
    const { data: entries, error: entriesError } = await adminSupabase
      .from("captain_log_entries")
      .select("*")
      .eq("subject_department_id", departmentId)
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
    const { data: responses, error: responsesError } = await adminSupabase
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
