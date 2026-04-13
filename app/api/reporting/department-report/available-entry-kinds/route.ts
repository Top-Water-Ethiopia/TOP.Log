import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveEntryKinds, EntryKindsError } from "@/lib/entry-kinds/resolve"
import { verifyPermissionForDepartmentFromRequest } from "@/lib/rbac/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get("departmentId")

    if (!departmentId) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 })
    }

    const canSubmit = await verifyPermissionForDepartmentFromRequest(request, "department_reports.submit", departmentId)
    if (!canSubmit.ok) {
      return NextResponse.json(
        { error: "Access denied", code: "FORBIDDEN_DEPT_REPORT_SUBMIT" },
        { status: 403 }
      )
    }

    let resolvedConfigs: any[] = []
    try {
      const resolved = await resolveEntryKinds({ system: "dept_report", departmentId, userId: user.id })
      resolvedConfigs = resolved.data
    } catch (e) {
      if (e instanceof EntryKindsError) {
        return NextResponse.json({ error: e.message, code: e.code }, { status: e.status })
      }
      return NextResponse.json({ error: "Failed to resolve department report entry kinds" }, { status: 500 })
    }

    // Department report reachability: department-scoped questions (role_id is null) for this department
    const { data: questions, error: queryError } = await supabase
      .from("role_questions")
      .select("entry_kind, department_id, department_profession_id, question_scope_type, is_active")
      .eq("department_id", departmentId)
      .eq("is_active", true)
      .is("department_profession_id", null)
      .eq("question_scope_type", "dept_report")

    if (queryError) {
      console.error("Error fetching department report questions:", queryError)
      return NextResponse.json({ error: "Failed to fetch department report types" }, { status: 500 })
    }

    const reachableKinds = new Set<string>()
    questions?.forEach((q: any) => {
      if (q?.entry_kind) reachableKinds.add(String(q.entry_kind))
    })

    const available = (resolvedConfigs || [])
      .filter((config: any) => reachableKinds.has(config.entry_kind))
      .map((config: any) => ({
        entry_kind: config.entry_kind,
        label: config.label,
        color: config.color,
        icon: config.icon,
        description: config.description,
        is_default: config.is_default,
        supports_assigned_agent: config.supports_assigned_agent,
        allow_multiple_per_day: config.allow_multiple_per_day ?? false,
      }))

    return NextResponse.json({ data: available })
  } catch (error) {
    console.error("Unexpected error in department-report available-entry-kinds:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
