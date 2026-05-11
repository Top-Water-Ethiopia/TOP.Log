import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyPermissionForDepartmentFromRequest } from "@/lib/rbac/server"
import { getMarketingDepartmentId } from "@/lib/server/marketing"
import { buildWindowHash, resolveTimeWindowFromQuery, TimeWindowError } from "@/lib/time-window/server"
import { computeVisibilitySignature } from "@/lib/time-window/visibility-signature"
import { buildDepartmentCoalesceOrFilter } from "@/lib/marketing-kpis/agent-calls"
import { MARKETING_CALL_MINUTES_KEYS } from "@/lib/marketing-kpis/call-minutes"
import { resolveConfiguredQuestionPairs } from "@/lib/marketing-kpis/config/resolve-configured-question-pairs"
import { sumNumericResponses } from "@/lib/marketing-kpis/numeric/sum-numeric-responses"

export const dynamic = "force-dynamic"

const CACHE_TTL_MS = 60_000
const cache = new Map<string, { at: number; value: number }>()
const inflight = new Map<string, Promise<number>>()
const MAX_DAYS = 90
const LIVE_MAX_DAYS = 31

function jsonError(
  status: number,
  body: { code: string; message: string; maxLiveDays?: number; maxDays?: number; suggestion?: string; suggestedPreset?: string }
) {
  return NextResponse.json(body, { status })
}

function getJoinedEntryKind(row: unknown): string | null {
  if (!row || typeof row !== "object") return null
  const joined = (row as any).captain_log_entries
  if (!joined || typeof joined !== "object" || Array.isArray(joined)) return null
  const kind = typeof joined.entry_kind === "string" ? joined.entry_kind.trim() : ""
  return kind || null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const preset = url.searchParams.get("preset")
  const date = url.searchParams.get("date")
  const dateFrom = url.searchParams.get("dateFrom")
  const dateTo = url.searchParams.get("dateTo")

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const marketingDepartmentId = await getMarketingDepartmentId()
  if (!marketingDepartmentId) return NextResponse.json({ error: "Marketing department not configured" }, { status: 500 })

  const adminAuth = await verifyPermissionForDepartmentFromRequest(request, "admin.system", marketingDepartmentId)
  const aggAuth = adminAuth.ok
    ? adminAuth
    : await verifyPermissionForDepartmentFromRequest(request, "entries.aggregate_department", marketingDepartmentId)
  if (!aggAuth.ok) return NextResponse.json({ error: "Access denied" }, { status: 403 })

  let resolved
  try {
    resolved = resolveTimeWindowFromQuery({ preset, date, dateFrom, dateTo, maxDays: MAX_DAYS, liveMaxDays: LIVE_MAX_DAYS })
  } catch (err) {
    if (err instanceof TimeWindowError) {
      const suggestion = err.code === "RANGE_TOO_LARGE" ? "Try preset=last7 or thisMonth" : undefined
      return jsonError(400, {
        code: err.code,
        message: err.message,
        maxLiveDays: err.maxLiveDays,
        maxDays: err.maxDays,
        suggestion,
        suggestedPreset: err.suggestedPreset,
      })
    }
    return jsonError(400, { code: "INVALID_DATE", message: "Invalid time window" })
  }

  const { window } = resolved
  const windowHash = buildWindowHash({ start: window.start, end: window.end, departmentId: marketingDepartmentId })
  const visibilitySignature = await computeVisibilitySignature({ userId: user.id, isAdmin: adminAuth.ok })

  const cacheKey = `call-minutes:${user.id}:${marketingDepartmentId}:${window.key}:${visibilitySignature}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json({
      kpi: "call_minutes",
      value: cached.value,
      window: { ...window, hash: windowHash },
      departmentId: marketingDepartmentId,
      meta: { aggregationMode: "live", aggregation: "sum", aggregationLabel: "Total call minutes in selected period", unit: "minutes", cache: { hit: true } },
    })
  }

  const existing = inflight.get(cacheKey)
  const promise =
    existing ||
    (async () => {
      const pairs = await resolveConfiguredQuestionPairs({
        supabase,
        questionKeys: MARKETING_CALL_MINUTES_KEYS,
        expectedQuestionType: "number",
      })

      if (pairs.resolvedKeys.length === 0) {
        console.info("[marketing-kpi] call_minutes missing_config", {
          userId: user.id,
          departmentId: marketingDepartmentId,
          window: { key: window.key, hash: windowHash, preset: window.preset },
          visibilitySignature,
          stats: pairs.stats,
        })
        cache.set(cacheKey, { at: Date.now(), value: 0 })
        return 0
      }

      const { data: rows, error } = await supabase
        .from("custom_responses")
        .select("question_key, value, captain_log_entries!inner(entry_kind)")
        .in("question_key", pairs.resolvedKeys)
        .in("captain_log_entries.entry_kind", pairs.resolvedEntryKinds)
        .gte("captain_log_entries.date", window.start)
        .lte("captain_log_entries.date", window.end)
        .or(buildDepartmentCoalesceOrFilter(marketingDepartmentId), { foreignTable: "captain_log_entries" })

      if (error) throw new Error(error.message)

      const summed = sumNumericResponses({
        rows: rows || [],
        allowedPairsByKey: pairs.allowedPairsByKey,
        getQuestionKey: (row) => row.question_key,
        getEntryKind: (row) => getJoinedEntryKind(row),
        getValue: (row) => row.value,
      })

      cache.set(cacheKey, { at: Date.now(), value: summed.sum })
      console.info("[marketing-kpi] ALLOW call_minutes", {
        userId: user.id,
        departmentId: marketingDepartmentId,
        window: { key: window.key, hash: windowHash, preset: window.preset },
        visibilitySignature,
        value: summed.sum,
        resolved: { keys: pairs.resolvedKeys.length, entryKinds: pairs.resolvedEntryKinds.length, stats: pairs.stats },
        skipped: summed.skipped,
      })
      return summed.sum
    })()
  if (!existing) inflight.set(cacheKey, promise)

  try {
    const value = await promise
    return NextResponse.json({
      kpi: "call_minutes",
      value,
      window: { ...window, hash: windowHash },
      departmentId: marketingDepartmentId,
      meta: { aggregationMode: "live", aggregation: "sum", aggregationLabel: "Total call minutes in selected period", unit: "minutes", cache: { hit: false } },
    })
  } catch (err) {
    return NextResponse.json({ error: "Failed to load KPI", message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  } finally {
    inflight.delete(cacheKey)
  }
}

