import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyPermissionForDepartmentFromRequest } from "@/lib/rbac/server"
import { getMarketingDepartmentId } from "@/lib/server/marketing"
import { buildWindowHash, resolveTimeWindowFromQuery, TimeWindowError } from "@/lib/time-window/server"
import { computeVisibilitySignature } from "@/lib/time-window/visibility-signature"
import { buildDepartmentCoalesceOrFilter } from "@/lib/marketing-kpis/agent-calls"
import { MARKETING_POSTS_PREPARED_QUESTION_LABELS } from "@/lib/marketing-kpis/posts-prepared"
import { resolveConfiguredPostPreparedPairs } from "@/lib/marketing-kpis/posts-prepared-resolver"
import { countUploadedAssets } from "@/lib/uploads/validate-uploaded-image-asset"

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

  const cacheKey = `posts-prepared:${user.id}:${marketingDepartmentId}:${window.key}:${visibilitySignature}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json({
      kpi: "posts_prepared",
      value: cached.value,
      window: { ...window, hash: windowHash },
      departmentId: marketingDepartmentId,
      meta: {
        aggregationMode: "live",
        aggregation: "count",
        aggregationLabel: "Entries with shared post content in selected period",
        unit: "entries",
        visibilityTiming: "query_time",
        cache: { hit: true, ttlSec: Math.max(0, Math.floor((CACHE_TTL_MS - (Date.now() - cached.at)) / 1000)) },
      },
    })
  }

  const existing = inflight.get(cacheKey)
  const promise =
    existing ||
    (async () => {
      const startedAt = Date.now()

      const resolvedPairs = await resolveConfiguredPostPreparedPairs({
        supabase,
        questionLabels: MARKETING_POSTS_PREPARED_QUESTION_LABELS,
      })

      if (resolvedPairs.resolvedKeys.length === 0) {
        console.info("[marketing-kpi] posts_prepared missing_config", {
          userId: user.id,
          departmentId: marketingDepartmentId,
          window: { key: window.key, hash: windowHash, preset: window.preset },
          visibilitySignature,
          resolved: {
            keys: 0,
            entryKinds: 0,
            stats: resolvedPairs.stats,
            warnings: resolvedPairs.warnings.slice(0, 5),
          },
        })
        const value = 0
        cache.set(cacheKey, { at: Date.now(), value })
        return value
      }

      const { data: rows, error } = await supabase
        .from("custom_responses")
        .select("question_key, value, captain_log_entries!inner(entry_kind)")
        .in("question_key", resolvedPairs.resolvedKeys)
        .in("captain_log_entries.entry_kind", resolvedPairs.resolvedEntryKinds)
        .gte("captain_log_entries.date", window.start)
        .lte("captain_log_entries.date", window.end)
        .or(buildDepartmentCoalesceOrFilter(marketingDepartmentId), { foreignTable: "captain_log_entries" })

      if (error) throw new Error(error.message)

      function getJoinedEntryKind(row: unknown): string | null {
        if (!row || typeof row !== "object") return null
        const joined = (row as any).captain_log_entries
        if (!joined || typeof joined !== "object" || Array.isArray(joined)) return null
        const kind = typeof joined.entry_kind === "string" ? joined.entry_kind.trim() : ""
        return kind ? kind : null
      }

      let value = 0
      let skippedMissingKey = 0
      let skippedMissingKind = 0
      let skippedPairMismatch = 0

      for (const row of rows || []) {
        const rawKey = typeof (row as any).question_key === "string" ? (row as any).question_key : ""
        const questionKey = rawKey.trim()
        if (!questionKey) {
          skippedMissingKey++
          continue
        }

        const entryKind = getJoinedEntryKind(row)
        if (!entryKind) {
          skippedMissingKind++
          continue
        }

        // Intentionally case-sensitive; only trimming is applied.
        if (!resolvedPairs.allowedPairsByKey.get(questionKey)?.has(entryKind)) {
          skippedPairMismatch++
          continue
        }

        value += countUploadedAssets((row as any).value)
      }

      cache.set(cacheKey, { at: Date.now(), value })
      console.info("[marketing-kpi] ALLOW posts_prepared", {
        userId: user.id,
        departmentId: marketingDepartmentId,
        window: { key: window.key, hash: windowHash, preset: window.preset },
        visibilitySignature,
        cache: { hit: false, ttlSec: Math.floor(CACHE_TTL_MS / 1000) },
        latencyMs: Date.now() - startedAt,
        value,
        meta: {
          resolved: {
            keys: resolvedPairs.resolvedKeys.length,
            entryKinds: resolvedPairs.resolvedEntryKinds.length,
            stats: resolvedPairs.stats,
          },
          skipped: { missingKey: skippedMissingKey, missingEntryKind: skippedMissingKind, pairMismatch: skippedPairMismatch },
        },
      })
      return value
    })()

  if (!existing) inflight.set(cacheKey, promise)

  let value: number
  try {
    value = await promise
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load KPI", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  } finally {
    inflight.delete(cacheKey)
  }

  return NextResponse.json({
    kpi: "posts_prepared",
    value,
    window: { ...window, hash: windowHash },
    departmentId: marketingDepartmentId,
    meta: {
      aggregationMode: "live",
      aggregation: "count",
      aggregationLabel: "Entries with shared post content in selected period",
      unit: "entries",
      visibilityTiming: "query_time",
      cache: { hit: false, ttlSec: Math.floor(CACHE_TTL_MS / 1000) },
    },
  })
}
