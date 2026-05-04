import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyPermissionForDepartmentFromRequest } from "@/lib/rbac/server"
import { getMarketingDepartmentId } from "@/lib/server/marketing"

export const dynamic = "force-dynamic"

function isValidISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

const CACHE_TTL_MS = 60_000
const cache = new Map<string, { at: number; value: number }>()

function getTodayISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const date = url.searchParams.get("date")?.trim() || ""

  if (!date || !isValidISODate(date)) {
    console.info("[marketing-kpi] DENY invalid_date", { date })
    return NextResponse.json({ error: "Invalid date. Expected YYYY-MM-DD." }, { status: 400 })
  }

  const today = getTodayISO()
  if (date > today) {
    console.info("[marketing-kpi] DENY future_date", { date, today })
    return NextResponse.json({ error: "Date cannot be in the future." }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    console.info("[marketing-kpi] DENY unauthenticated", { hasAuthError: !!authError })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const marketingDepartmentId = await getMarketingDepartmentId()
  if (!marketingDepartmentId) {
    console.info("[marketing-kpi] ERROR missing_marketing_department", { userId: user.id })
    return NextResponse.json({ error: "Marketing department not configured" }, { status: 500 })
  }

  const adminAuth = await verifyPermissionForDepartmentFromRequest(request, "admin.system", marketingDepartmentId)
  const aggAuth = adminAuth.ok
    ? adminAuth
    : await verifyPermissionForDepartmentFromRequest(request, "entries.aggregate_department", marketingDepartmentId)

  if (!aggAuth.ok) {
    console.info("[marketing-kpi] DENY missing_permission", {
      userId: user.id,
      departmentId: marketingDepartmentId,
      permission: "entries.aggregate_department",
    })
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  const cacheKey = `${user.id}:${marketingDepartmentId}:${date}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json({
      date,
      kpi: "agent_calls",
      value: cached.value,
      departmentId: marketingDepartmentId,
      meta: { entryKind: "agent_call", timezone: "Africa/Addis_Ababa", visibility: "rls", cache: "hit" },
    })
  }

  const { count, error } = await supabase
    .from("captain_log_entries")
    .select("id", { count: "exact", head: true })
    .eq("subject_department_id", marketingDepartmentId)
    .eq("entry_kind", "agent_call")
    .eq("date", date)

  if (error) {
    console.info("[marketing-kpi] ERROR query_failed", { userId: user.id, departmentId: marketingDepartmentId, date })
    return NextResponse.json({ error: "Failed to load KPI", message: error.message }, { status: 500 })
  }

  cache.set(cacheKey, { at: Date.now(), value: count ?? 0 })
  console.info("[marketing-kpi] ALLOW agent_calls", {
    userId: user.id,
    departmentId: marketingDepartmentId,
    date,
    value: count ?? 0,
  })

  return NextResponse.json({
    date,
    kpi: "agent_calls",
    value: count ?? 0,
    departmentId: marketingDepartmentId,
    meta: { entryKind: "agent_call", timezone: "Africa/Addis_Ababa", visibility: "rls", cache: "miss" },
  })
}
