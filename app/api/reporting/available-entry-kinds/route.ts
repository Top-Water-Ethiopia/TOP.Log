import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveRoleQuestionScope } from "@/lib/reporting-model"
import { resolveEntryKinds } from "@/lib/entry-kinds/resolve"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function isValidYyyyMmDd(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return false
  const [year, month, day] = value.split("-").map((p) => Number(p))
  return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month && d.getUTCDate() === day
}

function isoDow(yyyyMmDd: string): number {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`)
  const dow = d.getUTCDay() // 0=Sun..6=Sat
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
    const requestedRole = searchParams.get("professionId") || searchParams.get("role")
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

    // Resolve all active roles for the user in this department
    const { data: userMemberships } = await supabase
      .from("user_department_memberships")
      .select("role:roles(id, name)")
      .eq("user_id", user.id)
      .eq("department_id", departmentId)
      .eq("is_active", true)

    const userRoles = new Set<string>()
    if (requestedRole) userRoles.add(requestedRole)

    userMemberships?.forEach((m: any) => {
      const role = Array.isArray(m.role) ? m.role[0] : m.role
      if (role?.name) userRoles.add(role.name)
      if (role?.id) userRoles.add(role.id)
    })
    const previewProfessionRoleId = requestedRole && looksLikeUuid(requestedRole) ? requestedRole : null
    const previewProfessionKey = requestedRole && !looksLikeUuid(requestedRole) ? requestedRole : null

    let resolvedConfigs: any[] = []
    let resolvedMeta: any = null
    try {
      const resolved = await resolveEntryKinds({
        system: "personal",
        departmentId,
        userId: user.id,
        professionRoleId: previewProfessionRoleId,
        professionKey: previewProfessionKey,
      })
      resolvedConfigs = resolved.data
      resolvedMeta = resolved.meta ?? null
    } catch (e) {
      // For personal logging, missing config should not hard-fail the endpoint.
      console.error("Error resolving entry kinds:", e)
    }

    const configuredDefault =
      resolvedConfigs.find((c: any) => c?.is_default === true && typeof c?.entry_kind === "string")?.entry_kind ?? null

    const reportIsoDow = isoDow(date)

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

    // 2. Fetch active questions to determine reachability
    const { data: questions, error: queryError } = await supabase
      .from("role_questions")
      .select("entry_kind, department_id, department_profession_id, department_role, question_scope_type, is_active")
      .eq("department_id", departmentId)
      .eq("is_active", true)

    if (queryError) {
      console.error("Error fetching available entry kinds:", queryError)
      return NextResponse.json(
        { error: "Failed to fetch available types", details: queryError.message },
        { status: 500 }
      )
    }

    const reachableKinds = new Set<string>()
    if (questions) {
      questions.forEach((q) => {
        const scope = resolveRoleQuestionScope(q)
        if (!scope) return

        if (scope.kind === "dept_wide_personal") {
          reachableKinds.add(q.entry_kind)
        } else if (userRoles.size > 0 && scope.kind === "profession") {
          const matches =
            (scope.departmentProfessionId && userRoles.has(scope.departmentProfessionId)) ||
            (scope.departmentProfessionKey && userRoles.has(scope.departmentProfessionKey))

          if (matches) {
            reachableKinds.add(q.entry_kind)
          }
        }
      })
    }

    // 3. Combine configs with reachability
    const hadReachabilitySignal = reachableKinds.size > 0
    const reachabilityFiltered = eligibleByAvailability.filter((config: any) => reachableKinds.has(config.entry_kind))
    const selfHealed = hadReachabilitySignal && reachabilityFiltered.length === 0

    // If we did not find any reachable kinds for this role, fall back to the configured entry kinds
    // (date/availability-filtered). This prevents "No report types available" when questions are not yet configured
    // or when scope metadata is incomplete.
    let available = (selfHealed ? eligibleByAvailability : reachabilityFiltered)
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
        self_healed: selfHealed,
        ...(process.env.NODE_ENV !== "production"
          ? {
              debug: {
                requestedRole,
                previewProfessionRoleId,
                previewProfessionKey,
                resolvedMeta,
                resolvedConfigsCount: Array.isArray(resolvedConfigs) ? resolvedConfigs.length : null,
                eligibleByAvailabilityCount: Array.isArray(eligibleByAvailability) ? eligibleByAvailability.length : null,
                hadReachabilitySignal,
                reachableKindsCount: reachableKinds.size,
              },
            }
          : {}),
      },
    })
  } catch (error) {
    console.error("Unexpected error in available-entry-kinds:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
