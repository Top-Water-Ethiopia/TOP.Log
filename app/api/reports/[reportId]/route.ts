import { createClient } from "@/lib/supabase/server"
import { canViewDepartmentLogs } from "@/lib/logs/visibility"
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

    const { data: profile } = await supabase.from("user_profiles").select("role_id").eq("user_id", user.id).single()

    const isAdmin = profile?.role_id === ADMIN_ROLE_ID || profile?.role_id === SYSTEM_ADMIN_ROLE_ID
    const submittedByUserId =
      typeof report.submitted_by_user_id === "string" && report.submitted_by_user_id ? report.submitted_by_user_id : report.user_id
    const isOwnReport = submittedByUserId === user.id

    if (!isAdmin && !isOwnReport) {
      const reportDepartmentId =
        typeof report.subject_department_id === "string" && report.subject_department_id
          ? report.subject_department_id
          : typeof report.department_id === "string"
            ? report.department_id
            : null

      if (!reportDepartmentId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }

      const { data: departmentAccess } = await supabase
        .from("user_department_memberships")
        .select(
          `
          access_level:roles (
            name
          )
        `
        )
        .eq("user_id", user.id)
        .eq("department_id", reportDepartmentId)
        .eq("membership_type", "access_level")
        .maybeSingle()

      const accessLevelName = (departmentAccess?.access_level as { name?: string } | null)?.name || null
      const canViewDepartmentReport = canViewDepartmentLogs(accessLevelName)

      if (!canViewDepartmentReport) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
    }

    const { data: authorProfile } = await supabase
      .from("user_profiles")
      .select("name")
      .eq("user_id", submittedByUserId)
      .single()

    return NextResponse.json({ data: { ...report, profile: { name: authorProfile?.name ?? null } } })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
