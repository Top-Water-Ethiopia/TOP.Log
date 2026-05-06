import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyPermissionForDepartmentFromRequest } from "@/lib/rbac/server"
import { getMarketingDepartmentId } from "@/lib/server/marketing"
import { buildWindowHash, resolveTimeWindowFromQuery, TimeWindowError } from "@/lib/time-window/server"
import { computeVisibilitySignature } from "@/lib/time-window/visibility-signature"
import { buildDepartmentCoalesceOrFilter } from "@/lib/marketing-kpis/agent-calls"
import {
  AGENT_CONTACT_ENTRY_KIND,
  QUESTION_KEYS,
  classifyOutcome,
  computeRates,
  extractFailureReasons,
} from "@/lib/marketing-kpis/outcomes"

export const dynamic = "force-dynamic"

const CACHE_TTL_MS = 60_000
const cache = new Map<string, { at: number; value: any }>()
const inflight = new Map<string, Promise<any>>()

const MAX_DAYS = 90
const LIVE_MAX_DAYS = 31

function jsonError(
  status: number,
  body: { code: string; message: string; maxLiveDays?: number; maxDays?: number; suggestion?: string; suggestedPreset?: string }
) {
  return NextResponse.json(body, { status })
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

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const marketingDepartmentId = await getMarketingDepartmentId()
  if (!marketingDepartmentId) {
    return NextResponse.json({ error: "Marketing department not configured" }, { status: 500 })
  }

  const adminAuth = await verifyPermissionForDepartmentFromRequest(request, "admin.system", marketingDepartmentId)
  const aggAuth = adminAuth.ok
    ? adminAuth
    : await verifyPermissionForDepartmentFromRequest(request, "entries.aggregate_department", marketingDepartmentId)

  if (!aggAuth.ok) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  let resolved
  try {
    resolved = resolveTimeWindowFromQuery({
      preset,
      date,
      dateFrom,
      dateTo,
      maxDays: MAX_DAYS,
      liveMaxDays: LIVE_MAX_DAYS,
    })
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
  const cacheKey = `${user.id}:${marketingDepartmentId}:${window.key}:${visibilitySignature}`

  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json({
      kpi: "agent_contact_outcomes",
      window: { ...window, hash: windowHash },
      departmentId: marketingDepartmentId,
      ...cached.value,
      meta: {
        aggregation: "sum",
        unit: "entries",
        timezone: "Africa/Addis_Ababa",
        multiSelect: true,
        reasonSemantics: "% of failed contacts selecting each reason (multi-select allowed)",
        cache: { hit: true, ttlSec: Math.max(0, Math.floor((CACHE_TTL_MS - (Date.now() - cached.at)) / 1000)) },
      },
    })
  }

  const existing = inflight.get(cacheKey)
  const promise =
    existing ||
    (async () => {
      const startedAt = Date.now()

      const { data: entries, error: entriesError } = await supabase
        .from("captain_log_entries")
        .select("id")
        .or(buildDepartmentCoalesceOrFilter(marketingDepartmentId))
        .eq("entry_kind", AGENT_CONTACT_ENTRY_KIND)
        .gte("date", window.start)
        .lte("date", window.end)

      if (entriesError) throw new Error(entriesError.message)

      const entryIds = (entries || []).map((e) => e.id).filter(Boolean)
      const total = entryIds.length

      if (total === 0) {
        const value = {
          totals: { total: 0, success: 0, failed: 0, missing: 0 },
          rates: { successRate: 0, missingRate: 0 },
          reasons: { unspecified: 0 },
        }
        cache.set(cacheKey, { at: Date.now(), value })
        return { value, latencyMs: Date.now() - startedAt }
      }

      // Avoid huge `.in(entry_id, [...])` requests which can exceed PostgREST URL/body limits.
      // Instead, join through captain_log_entries and filter by the same window + department constraints.
      const { data: responses, error: responsesError } = await supabase
        .from("custom_responses")
        .select("entry_id, question_key, value, captain_log_entries!inner(id)")
        .in("question_key", [QUESTION_KEYS.CONTACT_SUCCESS, QUESTION_KEYS.FAILURE_REASON])
        .eq("captain_log_entries.entry_kind", AGENT_CONTACT_ENTRY_KIND)
        .gte("captain_log_entries.date", window.start)
        .lte("captain_log_entries.date", window.end)
        .or(buildDepartmentCoalesceOrFilter(marketingDepartmentId), { foreignTable: "captain_log_entries" })

      if (responsesError) throw new Error(responsesError.message)

      const successByEntry = new Map<string, unknown>()
      const reasonsByEntry = new Map<string, unknown>()

      for (const row of responses || []) {
        const entryId = String((row as any).entry_id || "")
        const key = String((row as any).question_key || "")
        const value = (row as any).value
        if (!entryId || !key) continue
        if (key === QUESTION_KEYS.CONTACT_SUCCESS) successByEntry.set(entryId, value)
        if (key === QUESTION_KEYS.FAILURE_REASON) reasonsByEntry.set(entryId, value)
      }

      let success = 0
      let failed = 0
      let missing = 0

      const reasonCounts = new Map<string, number>()
      let unspecified = 0

      for (const entryId of entryIds) {
        const rawSuccess = successByEntry.get(entryId)
        // Success values are stored as JSONB strings e.g. "Yes"
        const parsedSuccess = typeof rawSuccess === "string" ? rawSuccess.replace(/^\"|\"$/g, "") : rawSuccess
        const outcome = classifyOutcome(parsedSuccess)

        if (outcome === "success") {
          success++
          continue
        }

        if (outcome === "failed") {
          failed++
          const reasons = extractFailureReasons(reasonsByEntry.get(entryId))
          if (reasons.length === 0) {
            unspecified++
            continue
          }
          for (const r of reasons) {
            reasonCounts.set(r, (reasonCounts.get(r) || 0) + 1)
          }
          continue
        }

        missing++
      }

      const totals = { total, success, failed, missing }
      const rates = computeRates(totals)

      const reasons: Record<string, number> = { unspecified }
      for (const [k, v] of Array.from(reasonCounts.entries()).sort((a, b) => b[1] - a[1])) {
        reasons[k] = v
      }

      const value = { totals, rates, reasons }
      cache.set(cacheKey, { at: Date.now(), value })

      return { value, latencyMs: Date.now() - startedAt }
    })()

  if (!existing) inflight.set(cacheKey, promise)

  try {
    const { value, latencyMs } = await promise
    return NextResponse.json({
      kpi: "agent_contact_outcomes",
      window: { ...window, hash: windowHash },
      departmentId: marketingDepartmentId,
      ...value,
      meta: {
        aggregation: "sum",
        unit: "entries",
        timezone: "Africa/Addis_Ababa",
        multiSelect: true,
        reasonSemantics: "% of failed contacts selecting each reason (multi-select allowed)",
        cache: { hit: false, ttlSec: Math.floor(CACHE_TTL_MS / 1000) },
        latencyMs,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load KPI", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  } finally {
    inflight.delete(cacheKey)
  }
}
