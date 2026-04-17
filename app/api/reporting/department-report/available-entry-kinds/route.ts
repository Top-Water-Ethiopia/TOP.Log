import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveEntryKinds, EntryKindsError } from "@/lib/entry-kinds/resolve"
import { verifyPermissionForDepartmentFromRequest } from "@/lib/rbac/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isValidYyyyMmDd(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return false
  const [year, month, day] = value.split("-").map((p) => Number(p))
  return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month && d.getUTCDate() === day
}

function isoDow(yyyyMmDd: string): number {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`)
  const dow = d.getUTCDay()
  return dow === 0 ? 7 : dow
}

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
    const date = searchParams.get("date")

    if (!departmentId) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 })
    }

    if (!date) {
      return NextResponse.json(
        { error: "date (YYYY-MM-DD) is required", code: "REPORT_DATE_REQUIRED" },
        { status: 400 }
      )
    }

    if (!isValidYyyyMmDd(date)) {
      return NextResponse.json(
        { error: "date must be a valid YYYY-MM-DD", code: "REPORT_DATE_INVALID" },
        { status: 400 }
      )
    }

    const canSubmit = await verifyPermissionForDepartmentFromRequest(request, "department_reports.submit", departmentId)
    if (!canSubmit.ok) {
      return NextResponse.json({ error: "Access denied", code: "FORBIDDEN_DEPT_REPORT_SUBMIT" }, { status: 403 })
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

    const configuredDefault =
      resolvedConfigs.find((c: any) => c?.is_default === true && typeof c?.entry_kind === "string")?.entry_kind ?? null
    const reportIsoDow = isoDow(date)

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

    const eligibleByAvailability = (resolvedConfigs || []).filter((config: any) => {
      if (!config?.is_active) return false
      if (config?.is_available === false) return false
      const start = config?.available_start_date ? String(config.available_start_date) : null
      const end = config?.available_end_date ? String(config.available_end_date) : null
      if (start && start > date) return false
      if (end && end < date) return false
      const weekdays = Array.isArray(config?.allowed_weekdays) ? (config.allowed_weekdays as unknown[]) : null
      if (!weekdays || weekdays.length === 0) return true
      return weekdays.map((w) => Number(w)).includes(reportIsoDow)
    })

    let available = eligibleByAvailability
      .filter((config: any) => reachableKinds.has(config.entry_kind))
      .map((config: any) => ({
        entry_kind: config.entry_kind,
        label: config.label,
        color: config.color,
        icon: config.icon,
        description: config.description,
        sort_order: config.sort_order ?? 0,
        is_default: config.is_default,
        supports_assigned_agent: config.supports_assigned_agent,
        allow_multiple_per_day: config.allow_multiple_per_day ?? false,
      }))

    available.sort((a: any, b: any) => {
      if ((a.sort_order ?? 0) !== (b.sort_order ?? 0)) return (a.sort_order ?? 0) - (b.sort_order ?? 0)
      return String(a.label ?? "").localeCompare(String(b.label ?? ""))
    })

    const hasConfiguredRows = Array.isArray(resolvedConfigs) && resolvedConfigs.length > 0
    if (hasConfiguredRows && available.length === 0) {
      return NextResponse.json(
        {
          error:
            "No report types are available for this department on the selected date. Ask an admin to update Entry Kinds.",
          code: "DEPT_REPORT_NO_AVAILABLE_ENTRY_KINDS",
        },
        { status: 422 }
      )
    }

    const configuredDefaultPresent =
      configuredDefault != null && available.some((a: any) => a.entry_kind === configuredDefault)
    const effectiveDefault = configuredDefaultPresent
      ? configuredDefault
      : available.length > 0
        ? available[0].entry_kind
        : null

    const defaultMissing = configuredDefault != null && !configuredDefaultPresent

    if (defaultMissing && effectiveDefault) {
      available = available.map((k: any) => ({ ...k, is_default: k.entry_kind === effectiveDefault }))
    }

    return NextResponse.json({
      data: available,
      meta: {
        configured_default: configuredDefault,
        effective_default: effectiveDefault,
        default_missing: defaultMissing,
        suggested_default: effectiveDefault,
      },
    })
  } catch (error) {
    console.error("Unexpected error in department-report available-entry-kinds:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
