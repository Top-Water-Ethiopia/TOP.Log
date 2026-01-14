import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

export async function GET(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await params

    if (!reportId) {
      return NextResponse.json({ error: "Report ID is required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the report (avoid an inner join on user_profiles here, since missing profiles or RLS
    // on user_profiles can incorrectly make the report look "not found").
    const { data: report, error: reportError } = await supabase
      .from("captain_log_entries")
      .select(
        `
        *,
        custom_responses (
          question_id,
          question_key,
          question_label,
          question_type,
          value
        )
      `
      )
      .eq("id", reportId)
      .single()

    if (reportError) {
      // Supabase/postgrest uses different error codes depending on the client.
      // We treat "no rows" as 404 and permission/RLS-style errors as 403.
      const message = (reportError as { message?: string }).message || ""
      const code = (reportError as { code?: string }).code || ""

      if (code === "PGRST116" || /0 rows/i.test(message)) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 })
      }

      if (/permission denied|rls|not allowed/i.test(message)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }

      console.error("Report fetch error:", reportError)
      return NextResponse.json({ error: "Failed to load report" }, { status: 500 })
    }

    // Check if user has access to this report
    // For now, allow access if user is admin or if it's their own report
    // You may want to add more sophisticated access control based on departments
    const { data: profile } = await supabase.from("user_profiles").select("role_id").eq("user_id", user.id).single()

    const isAdmin = profile?.role_id === ADMIN_ROLE_ID || profile?.role_id === SYSTEM_ADMIN_ROLE_ID
    const isOwnReport = report.user_id === user.id

    if (!isAdmin && !isOwnReport) {
      // Check if user is in the same department as the report author
      const { data: currentUserDept } = await supabase
        .from("user_profiles")
        .select("department_id")
        .eq("user_id", user.id)
        .single()

      const { data: reportAuthorDept } = await supabase
        .from("user_profiles")
        .select("department_id")
        .eq("user_id", report.user_id)
        .single()

      if (currentUserDept?.department_id !== reportAuthorDept?.department_id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
    }

    const { data: authorProfile } = await supabase
      .from("user_profiles")
      .select("name")
      .eq("user_id", report.user_id)
      .single()

    return NextResponse.json({ data: { ...report, profile: { name: authorProfile?.name ?? null } } })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
