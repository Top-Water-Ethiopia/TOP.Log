import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyPermissionForDepartmentFromRequest } from "@/lib/rbac/server"
import { getMarketingDepartmentId } from "@/lib/server/marketing"
import { buildWindowHash, resolveTimeWindowFromQuery, TimeWindowError } from "@/lib/time-window/server"
import { computeVisibilitySignature } from "@/lib/time-window/visibility-signature"
import { countEntryKindInWindow } from "@/lib/marketing-kpis/entries/count-entry-kind-in-window"

export const dynamic = "force-dynamic"
const CACHE_TTL_MS = 60_000
const cache = new Map<string, { at: number; value: number }>()
const inflight = new Map<string, Promise<number>>()
const MAX_DAYS = 90
const LIVE_MAX_DAYS = 31
const ENTRY_KIND = "agent_contact"

function jsonError(status: number, body: { code: string; message: string; maxLiveDays?: number; maxDays?: number; suggestion?: string; suggestedPreset?: string }) {
  return NextResponse.json(body, { status })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const preset = url.searchParams.get("preset")
  const date = url.searchParams.get("date")
  const dateFrom = url.searchParams.get("dateFrom")
  const dateTo = url.searchParams.get("dateTo")
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const marketingDepartmentId = await getMarketingDepartmentId()
  if (!marketingDepartmentId) return NextResponse.json({ error: "Marketing department not configured" }, { status: 500 })
  const adminAuth = await verifyPermissionForDepartmentFromRequest(request, "admin.system", marketingDepartmentId)
  const aggAuth = adminAuth.ok ? adminAuth : await verifyPermissionForDepartmentFromRequest(request, "entries.aggregate_department", marketingDepartmentId)
  if (!aggAuth.ok) return NextResponse.json({ error: "Access denied" }, { status: 403 })
  let resolved
  try {
    resolved = resolveTimeWindowFromQuery({ preset, date, dateFrom, dateTo, maxDays: MAX_DAYS, liveMaxDays: LIVE_MAX_DAYS })
  } catch (err) {
    if (err instanceof TimeWindowError) {
      const suggestion = err.code === "RANGE_TOO_LARGE" ? "Try preset=last7 or thisMonth" : undefined
      return jsonError(400, { code: err.code, message: err.message, maxLiveDays: err.maxLiveDays, maxDays: err.maxDays, suggestion, suggestedPreset: err.suggestedPreset })
    }
    return jsonError(400, { code: "INVALID_DATE", message: "Invalid time window" })
  }
  const { window } = resolved
  const windowHash = buildWindowHash({ start: window.start, end: window.end, departmentId: marketingDepartmentId })
  const visibilitySignature = await computeVisibilitySignature({ userId: user.id, isAdmin: adminAuth.ok })
  const cacheKey = `agent-contacts-count:${user.id}:${marketingDepartmentId}:${window.key}:${visibilitySignature}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return NextResponse.json({ kpi: "agent_contacts_count", value: cached.value, window: { ...window, hash: windowHash }, departmentId: marketingDepartmentId, meta: { aggregationMode: "live", aggregation: "count", aggregationLabel: "Agent contact logs in selected period", unit: "logs", cache: { hit: true } } })
  const existing = inflight.get(cacheKey)
  const promise = existing || (async () => {
    const result = await countEntryKindInWindow({ supabase, marketingDepartmentId, entryKind: ENTRY_KIND, window })
    if (result.errorMessage) throw new Error(result.errorMessage)
    cache.set(cacheKey, { at: Date.now(), value: result.value })
    console.info("[marketing-kpi] ALLOW agent_contacts_count", { userId: user.id, departmentId: marketingDepartmentId, window: { key: window.key, hash: windowHash, preset: window.preset }, visibilitySignature, value: result.value })
    return result.value
  })()
  if (!existing) inflight.set(cacheKey, promise)
  try {
    const value = await promise
    return NextResponse.json({ kpi: "agent_contacts_count", value, window: { ...window, hash: windowHash }, departmentId: marketingDepartmentId, meta: { aggregationMode: "live", aggregation: "count", aggregationLabel: "Agent contact logs in selected period", unit: "logs", cache: { hit: false } } })
  } catch (err) {
    return NextResponse.json({ error: "Failed to load KPI", message: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  } finally {
    inflight.delete(cacheKey)
  }
}

