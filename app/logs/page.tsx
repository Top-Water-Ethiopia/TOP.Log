import { redirect } from "next/navigation"
export const revalidate = 60 // Cache for 60 seconds
import Link from "next/link"
import { Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatDateHuman } from "@/lib/date-restrictions"
import { getReportStatus } from "@/lib/completion-status"
import { buildLogsPageHref, getMonthDateRange, normalizeLogsPageState } from "@/lib/logs-page-filters"
import type { Database } from "@/lib/supabase/database.types"
import type { LogsPageSearchParams } from "@/lib/logs-page-filters"
import type { CalendarDaySummary, LogEntry } from "@/lib/logs/types"
import {
  normalizeDepartmentAccessLevelName,
  canAccessLog,
  canViewDepartmentLogs,
  enqueueAuditLog,
} from "@/lib/logs/visibility"
import {
  getAgentSnapshotName,
  isMarketingDepartmentName,
  isSalesPromoterProfessionKey,
  normalizeSalesPromoterProfessionKey,
} from "@/lib/marketing-agents"
import { LogsCalendar } from "@/components/logs/logs-calendar"
import { LogsFilters } from "@/components/logs/logs-filters"
import { LogsList } from "@/components/logs/logs-list"
import { LogReportPreviewPanel } from "@/components/logs/log-report-preview-panel"
import { LogsViewToggle } from "@/components/logs/logs-view-toggle"
import { LogsFilesView } from "@/components/logs/files-view"
import { rateLimit } from "@/lib/rate-limit"
import { unstable_cache } from "next/cache"
import type { ScopeEntryKind } from "@/hooks/use-entry-kinds"
import { applySearchPostFilters } from "@/lib/logs/search-post-filters"

interface LogsViewerProfile {
  role_id: string
  department_id: string | null
  role_name: string | null
}

interface ViewerDepartmentAccess {
  access_level_name: string | null
  can_view_department_logs: boolean
}

interface LogRow {
  created_at: string | null
  date: string
  department_id: string | null
  departments: { name?: string } | null
  entry_kind?: string | null
  id: string
  report_kind?: string | null
  subject_agent_snapshot?: unknown
  subject_profession_id?: string | null
  updated_at: string | null
  user_id: string
  user_profiles: { name: string } | null
  total_user_logs?: number
}

type SearchLogsRow = any

interface ViewerDepartmentProfession {
  profession_key: string | null
}

async function fetchAccessibleDepartmentIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string[]> {
  const { data: memberships, error } = await supabase
    .from("user_department_memberships")
    .select("department_id")
    .eq("user_id", userId)
    .eq("is_active", true)

  if (error) return []
  return (memberships || [])
    .map((m) => m.department_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
}

interface LogCursor {
  date: string
  id: string
}

async function mapRowsToLogs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: LogRow[] | null | undefined
): Promise<LogEntry[]> {
  const data = rows || []
  if (data.length === 0) return []

  const logIds = data.map((row) => row.id)
  const { data: responses } = await supabase.from("custom_responses").select("entry_id").in("entry_id", logIds)

  const responseCounts = new Map<string, number>()
  responses?.forEach((r) => {
    responseCounts.set(r.entry_id, (responseCounts.get(r.entry_id) || 0) + 1)
  })

  return data.map((entry) => ({
    id: entry.id,
    date: entry.date,
    department_id: entry.department_id,
    department_name: entry.departments?.name || "Unknown",
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    response_count: responseCounts.get(entry.id) || 0,
    entry_kind: entry.entry_kind || "standard",
    report_kind: entry.report_kind || null,
    subject_profession_id: entry.subject_profession_id || null,
    subject_agent_name: getAgentSnapshotName(entry.subject_agent_snapshot),
    subject_agent_snapshot:
      typeof entry.subject_agent_snapshot === "object" && entry.subject_agent_snapshot !== null
        ? (entry.subject_agent_snapshot as LogEntry["subject_agent_snapshot"])
        : null,
    user: {
      id: entry.user_id,
      name: entry.user_profiles?.name || "Deleted User",
    },
  }))
}

interface FlattenedLogItem {
  id: string
  type: "header" | "dateHeader" | "row"
  userId: string
  userName: string
  date?: string
  data?: LogEntry
  summary?: {
    totalLogs: number
    lastSubmission: string
  }
}

function flattenLogs(logs: LogEntry[], groupByDate: boolean): FlattenedLogItem[] {
  const flattened: FlattenedLogItem[] = []
  const userGroups = new Map<string, LogEntry[]>()

  // Preserve stable ordering
  logs.forEach((log) => {
    const list = userGroups.get(log.user.id) || []
    list.push(log)
    userGroups.set(log.user.id, list)
  })

  userGroups.forEach((entries, userId) => {
    const userName = entries[0]?.user.name || "Unknown User"

    // Add Header
    flattened.push({
      id: `header-${userId}`,
      type: "header",
      userId,
      userName,
      summary: {
        totalLogs: entries.length,
        lastSubmission: entries[0]?.date || "",
      },
    })

    // Add Rows
    let lastDate: string | null = null
    entries.forEach((log) => {
      if (groupByDate && log.date && log.date !== lastDate) {
        lastDate = log.date
        flattened.push({
          id: `date-${userId}-${log.date}`,
          type: "dateHeader",
          userId,
          userName,
          date: log.date,
        })
      }
      flattened.push({
        id: log.id,
        type: "row",
        userId,
        userName,
        data: log,
      })
    })
  })

  return flattened
}

// Fetch profession roles based on ACTUAL DATA USAGE in the department (optimized single query)
async function fetchDepartmentProfessionRoles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  departmentId: string
): Promise<Array<{ id: string; name: string; label: string }>> {
  // Professions are modeled as roles (type='profession') after the memberships migration.
  // Use roles as the source of truth for the department’s profession list.
  const { data: professionRoles, error } = await supabase
    .from("roles")
    .select("id, name, display_name, sort_order")
    .eq("department_id", departmentId)
    .eq("type", "profession")
    .eq("is_active", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("display_name", { ascending: true })

  if (error || !professionRoles || professionRoles.length === 0) return []

  return professionRoles.map((role: any) => ({
    id: role.id,
    name: role.name,
    label: role.display_name || role.name,
  }))
}

// Fetch entry kinds for logs filtering (HISTORICAL TRUTH - no availability windows)
async function fetchDepartmentEntryKinds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  departmentId: string,
  professionRoleId?: string | null
): Promise<Array<{ entry_kind: string; label: string }>> {
  // Get entry kinds ACTUALLY USED in logs for this department (data-driven)
  let query = supabase.from("captain_log_entries").select("entry_kind").eq("subject_department_id", departmentId)

  // If profession is selected, filter by profession-specific logs
  if (professionRoleId) {
    query = query.eq("subject_profession_id", professionRoleId)
  }

  const { data: logEntryKinds } = await query.not("entry_kind", "is", null)

  if (!logEntryKinds || logEntryKinds.length === 0) return []

  // Get distinct entry kinds used in logs
  const distinctKinds = new Set(logEntryKinds.map((lek: any) => lek.entry_kind))

  // Join with scope_entry_kinds to get labels (for display, NOT for filtering)
  const { data: scopeKinds } = await supabase
    .from("scope_entry_kinds")
    .select("entry_kind, label")
    .eq("department_id", departmentId)
    .in("entry_kind", Array.from(distinctKinds))
    .eq("is_active", true)

  // Combine: use scope label if available, otherwise use raw entry_kind with fallback hierarchy
  const kindMap = new Map<string, string>()
  ;(scopeKinds || []).forEach((sk: any) => {
    kindMap.set(sk.entry_kind, sk.label || sk.entry_kind)
  })

  // Fallback hierarchy for labels:
  // 1. scope_entry_kinds.label (preferred)
  // 2. Formatted entry_kind (e.g., "agent_call" → "Agent Call")
  const formatEntryKind = (ek: string): string => {
    return ek
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ")
  }

  return Array.from(distinctKinds)
    .map((entry_kind) => ({
      entry_kind,
      label: kindMap.get(entry_kind) || formatEntryKind(entry_kind),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

async function fetchUserLogs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  filters: {
    date?: string
    departmentId?: string
    cursor?: LogCursor | null
    limit: number
    canViewDepartmentLogs?: boolean
    searchName?: string
    professionRoleId?: string
    entryKind?: string
  }
): Promise<{
  count: number
  hasMore: boolean
  logs: LogEntry[]
  nextCursor: LogCursor | null
}> {
  // Use RPC function for search with cursor pagination
  if (filters.searchName) {
    const { data, error } = await supabase.rpc("search_logs", {
      p_user_id: userId,
      p_date: filters.date || undefined,
      p_department_id: filters.departmentId || undefined,
      p_search_name: filters.searchName,
      p_cursor_date: filters.cursor?.date || undefined,
      p_cursor_id: filters.cursor?.id || undefined,
      p_limit: filters.limit,
      p_can_view_department_logs: filters.canViewDepartmentLogs || undefined,
    })

    if (error) {
      console.error("Error searching logs:", error.message)
      return { logs: [], count: 0, hasMore: false, nextCursor: null }
    }

    // RPC returns typed rows, map to LogEntry format
    const logs = ((data as SearchLogsRow[]) || []).map((row) => ({
      id: row.id,
      date: row.date,
      department_id: row.subject_department_id,
      department_name: row.department_name || "Unknown",
      created_at: row.created_at,
      updated_at: row.updated_at,
      response_count: row.response_count || 0,
      entry_kind: (row as any).entry_kind || "standard",
      report_kind: (row as any).report_kind || null,
      subject_profession_id: (row as any).subject_profession_id || null,
      subject_agent_name: getAgentSnapshotName((row as any).subject_agent_snapshot),
      subject_agent_snapshot: (row as any).subject_agent_snapshot as LogEntry["subject_agent_snapshot"],
      user: {
        id: row.user_id,
        name: row.user_name || "Deleted User",
      },
    })) as LogEntry[]

    // Some deployments / older RPC versions may return NULL subject_agent_snapshot even when the entry has it.
    // Backfill from captain_log_entries by id so list UI can always show agent identity for agent-related logs.
    const ids = logs.map((l) => l.id).filter(Boolean)
    if (ids.length > 0) {
      const { data: backfillRows } = await supabase
        .from("captain_log_entries")
        .select("id, subject_agent_snapshot, subject_profession_id, report_kind, entry_kind")
        .in("id", ids)

      const backfillMap = new Map<
        string,
        {
          entry_kind?: string | null
          report_kind?: string | null
          subject_profession_id?: string | null
          subject_agent_snapshot?: unknown
        }
      >()
      ;(backfillRows || []).forEach((row: any) => {
        backfillMap.set(row.id, row)
      })

      logs.forEach((log) => {
        const backfill = backfillMap.get(log.id)
        if (!backfill) return

        log.entry_kind = backfill.entry_kind || log.entry_kind
        log.report_kind = backfill.report_kind || log.report_kind
        log.subject_profession_id = backfill.subject_profession_id || log.subject_profession_id

        if (!log.subject_agent_snapshot && backfill.subject_agent_snapshot) {
          log.subject_agent_snapshot = backfill.subject_agent_snapshot as LogEntry["subject_agent_snapshot"]
        }
        if (!log.subject_agent_name) {
          log.subject_agent_name = getAgentSnapshotName(log.subject_agent_snapshot)
        }
      })
    }

    // Apply additional filters locally for search (profession/entryKind).
    // The underlying RPC does not currently accept these filters in all deployments.
    const filteredLogs = applySearchPostFilters(logs, {
      professionRoleId: filters.professionRoleId,
      entryKind: filters.entryKind,
    })

    // LIMIT+1 pattern: trim extra row if present (after filtering)
    const hasMore = filteredLogs.length > filters.limit
    const trimmedLogs = hasMore ? filteredLogs.slice(0, filters.limit) : filteredLogs
    const nextCursor = hasMore
      ? {
          date: trimmedLogs[trimmedLogs.length - 1].date,
          id: trimmedLogs[trimmedLogs.length - 1].id,
        }
      : null

    return {
      logs: trimmedLogs,
      count: trimmedLogs.length, // RPC doesn't return total count
      hasMore,
      nextCursor,
    }
  }

  // Existing Supabase query builder for non-search queries
  let query = supabase
    .from("captain_log_entries")
    .select(
      `
      id,
      date,
      department_id:subject_department_id,
      created_at,
      updated_at,
      entry_kind,
      report_kind,
      subject_agent_snapshot,
      subject_profession_id,
      user_id,
      departments:subject_department_id (name),
      user_profiles!captain_log_entries_user_profiles_user_id_fkey (name)
    `,
      { count: "exact" }
    )
    .order("date", { ascending: false })
    .order("id", { ascending: false })

  if (!filters.canViewDepartmentLogs) {
    query = query.eq("user_id", userId)
  }

  if (filters.departmentId) {
    query = query.eq("subject_department_id", filters.departmentId)
  } else {
    const accessibleDepartmentIds = await fetchAccessibleDepartmentIds(supabase, userId)
    if (accessibleDepartmentIds.length === 0) {
      return { logs: [], count: 0, hasMore: false, nextCursor: null }
    }
    query = query.in("subject_department_id", accessibleDepartmentIds)
  }

  if (filters.professionRoleId) {
    query = query.eq("subject_profession_id", filters.professionRoleId)
  }

  if (filters.entryKind) {
    query = query.eq("entry_kind", filters.entryKind)
  }

  if (filters.date) {
    query = query.eq("date", filters.date)
  }

  // Composite Cursor Logic: (date, id) < (cursor_date, cursor_id)
  if (filters.cursor) {
    query = query.or(`date.lt.${filters.cursor.date},and(date.eq.${filters.cursor.date},id.lt.${filters.cursor.id})`)
  }

  const { data, error, count } = await query.limit(filters.limit)

  if (error) {
    console.error("Error fetching logs:", error.message)
    return { logs: [], count: 0, hasMore: false, nextCursor: null }
  }

  const logs = await mapRowsToLogs(supabase, (data as LogRow[] | null | undefined) || [])
  const totalCount = count || 0

  const hasMore = logs.length === filters.limit
  const nextCursor = hasMore
    ? {
        date: logs[logs.length - 1].date,
        id: logs[logs.length - 1].id,
      }
    : null

  return {
    logs,
    count: totalCount,
    hasMore,
    nextCursor,
  }
}

async function fetchLogsForMonth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  filters: {
    departmentId?: string
    month: string
    canViewDepartmentLogs?: boolean
    professionRoleId?: string
    entryKind?: string
  }
): Promise<LogEntry[]> {
  const { endDate, startDate } = getMonthDateRange(filters.month)

  let query = supabase
    .from("captain_log_entries")
    .select(
      `
      id,
      date,
      department_id:subject_department_id,
      created_at,
      updated_at,
      entry_kind,
      report_kind,
      subject_agent_snapshot,
      subject_profession_id,
      user_id,
      departments:subject_department_id (name),
      user_profiles!captain_log_entries_user_profiles_user_id_fkey (name)
    `
    )
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })

  // Apply same permission and filter logic as list view
  if (!filters.canViewDepartmentLogs) {
    query = query.eq("user_id", userId)
  }

  if (filters.departmentId) {
    query = query.eq("subject_department_id", filters.departmentId)
  } else {
    const accessibleDepartmentIds = await fetchAccessibleDepartmentIds(supabase, userId)

    if (accessibleDepartmentIds.length === 0) {
      return []
    }

    query = query.in("subject_department_id", accessibleDepartmentIds)
  }

  if (filters.professionRoleId) {
    query = query.eq("subject_profession_id", filters.professionRoleId)
  }

  if (filters.entryKind) {
    query = query.eq("entry_kind", filters.entryKind)
  }

  // Performance safeguard: limit calendar view to prevent large result sets
  const { data, error } = await query.limit(2000)

  if (error) {
    console.error("Error fetching month logs:", error)
    return []
  }

  return mapRowsToLogs(supabase, (data as LogRow[] | null | undefined) || [])
}

async function fetchUserDepartments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  assignedDepartmentId?: string | null
): Promise<Array<{ id: string; name: string }>> {
  if (assignedDepartmentId) {
    const { data: department, error } = await supabase
      .from("departments")
      .select("id, name")
      .eq("id", assignedDepartmentId)
      .maybeSingle()

    if (error || !department) {
      return []
    }

    return [{ id: department.id, name: department.name }]
  }

  const accessibleDepartmentIds = await fetchAccessibleDepartmentIds(supabase, userId)

  if (accessibleDepartmentIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from("departments")
    .select("id, name")
    .in("id", accessibleDepartmentIds)
    .order("name", { ascending: true })

  if (error || !data) {
    return []
  }

  return data.map((department) => ({
    id: department.id,
    name: department.name,
  }))
}

async function fetchViewerProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<LogsViewerProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      `
      role_id,
      department_id,
      roles:role_id (
        name
      )
    `
    )
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return {
    role_id: data.role_id,
    department_id: data.department_id,
    role_name: (data.roles as { name?: string } | null)?.name || null,
  }
}

async function fetchViewerDepartmentProfession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  departmentId: string
): Promise<ViewerDepartmentProfession | null> {
  const { data: membership, error } = await supabase
    .from("user_department_memberships")
    .select(
      `
      role:roles (
        name
      )
    `
    )
    .eq("user_id", userId)
    .eq("department_id", departmentId)
    .eq("membership_type", "profession")
    .eq("is_active", true)
    .maybeSingle()

  if (error || !membership) {
    return null
  }

  const roleResult = Array.isArray(membership.role) ? membership.role[0] : membership.role
  const professionKey = roleResult?.name ? normalizeSalesPromoterProfessionKey(roleResult.name) : null

  return {
    profession_key: professionKey,
  }
}

async function fetchUserDepartmentAccessLevels(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<Map<string, string>> {
  const { data: memberships, error } = await supabase
    .from("user_department_memberships")
    .select("department_id, role:roles(name)")
    .eq("user_id", userId)
    .eq("membership_type", "access_level")
    .eq("is_active", true)

  if (error || !memberships) {
    return new Map()
  }

  const accessMap = new Map<string, string>()
  memberships.forEach((m) => {
    const roleResult = Array.isArray(m.role) ? m.role[0] : m.role
    if (roleResult?.name) {
      accessMap.set(m.department_id, roleResult.name)
    }
  })

  return accessMap
}

async function fetchViewerDepartmentAccess(
  accessMap: Map<string, string>,
  departmentId?: string | null
): Promise<ViewerDepartmentAccess> {
  if (!departmentId) {
    return {
      access_level_name: null,
      can_view_department_logs: false,
    }
  }

  const accessLevelName = accessMap.get(departmentId) || null

  return {
    access_level_name: accessLevelName,
    can_view_department_logs: canViewDepartmentLogs(accessLevelName),
  }
}

async function fetchEntryKindConfigs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  departmentIds: string[]
): Promise<ScopeEntryKind[]> {
  if (departmentIds.length === 0) return []

  try {
    const { data, error } = await (supabase as any)
      .from("scope_entry_kinds")
      .select("*")
      .in("department_id", departmentIds)
      .eq("is_active", true)

    if (error) {
      console.error("Failed to fetch entry kind configs:", error)
      return []
    }

    return (data || []) as ScopeEntryKind[]
  } catch (error) {
    console.error("Error fetching entry kind configs:", error)
    return []
  }
}

function summarizeCalendarDays(logs: LogEntry[]): CalendarDaySummary[] {
  const summaryMap = new Map<string, number>()

  logs.forEach((log) => {
    summaryMap.set(log.date, (summaryMap.get(log.date) || 0) + 1)
  })

  return Array.from(summaryMap.entries())
    .map(([date, entryCount]) => ({ date, entryCount }))
    .sort((left, right) => left.date.localeCompare(right.date))
}

export default async function LogsPage({ searchParams }: { searchParams: Promise<LogsPageSearchParams> }) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    const params = await searchParams
    const redirectState = normalizeLogsPageState(params)
    const redirectHref = buildLogsPageHref({
      ...redirectState,
      page: redirectState.page.toString(),
    })
    redirect(`/login?redirect=${encodeURIComponent(redirectHref)}`)
  }

  const userId = user.id
  const rawParams = await searchParams
  const viewerProfile = await fetchViewerProfile(supabase, userId)
  const accessMap = await fetchUserDepartmentAccessLevels(supabase, userId)
  const accessibleDepartmentIds = await fetchAccessibleDepartmentIds(supabase, userId)

  // A user is "basic" only if they don't have lead/manager permissions in any department
  const hasAnyLeadPermission = Array.from(accessMap.values()).some((role) => canViewDepartmentLogs(role))
  const canAccessAdmin = ["admin", "system-admin", "super-admin"].includes(viewerProfile?.role_name || "")
  const isBasicUser = !canAccessAdmin && !hasAnyLeadPermission

  // Auto-select department if user has a membership (not just basic user with department_id)
  const userMembershipDepartmentId =
    !isBasicUser && accessibleDepartmentIds.length === 1 ? accessibleDepartmentIds[0] : undefined
  const forcedDepartmentId = isBasicUser ? viewerProfile?.department_id || undefined : undefined

  const pageState = normalizeLogsPageState({
    ...rawParams,
    departmentId: rawParams.departmentId || forcedDepartmentId || userMembershipDepartmentId,
  })

  // Resolve visibility: if we have a specific department, check its access.
  // If no department selected but user is a lead in some departments,
  // allow broad visibility for fetch calls (API will filter by accessible departments).
  const viewerDepartmentAccess = await fetchViewerDepartmentAccess(accessMap, pageState.departmentId)
  // 1. Principal-grade Per-User Rate Limiting
  const rl = await rateLimit(user.id, { limit: 60, windowMs: 60000, burst: 10 })
  if (!rl.success) {
    enqueueAuditLog(supabase, {
      user_id: user.id,
      action: "RATE_LIMIT_EXCEEDED",
      resource_type: "api_endpoint",
      resource_id: "/logs",
      severity: "medium",
      metadata: { rl },
    })
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h3 className="text-destructive text-lg font-semibold">Too Many Requests</h3>
            <p className="text-muted-foreground mt-2 text-sm">
              You have exceeded the rate limit. Please wait a moment and try again.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const effectiveCanViewDepartmentLogs =
    viewerDepartmentAccess.can_view_department_logs || (!pageState.departmentId && hasAnyLeadPermission)

  // Skip cache for granular filters (profession or entryKind) to prevent cache explosion
  const hasGranularFilters = !!(pageState.professionRoleId || pageState.entryKind)

  // Fetch filter options when department is selected
  const [professionRoles, entryKinds] = await Promise.all([
    pageState.departmentId && !isBasicUser
      ? fetchDepartmentProfessionRoles(supabase, pageState.departmentId)
      : Promise.resolve([]),
    pageState.departmentId && !isBasicUser
      ? fetchDepartmentEntryKinds(supabase, pageState.departmentId, pageState.professionRoleId)
      : Promise.resolve([]),
  ])

  // Define cached logs fetcher for atomic, permission-aware isolation
  const getCachedUserLogs = unstable_cache(
    async (userId: string, filters: any) => {
      console.log(`[Cache] MISS for user ${userId}`)
      return fetchUserLogs(supabase, userId, filters)
    },
    ["user-logs-v2"],
    {
      revalidate: 60,
      tags: [
        `user-${user.id}`,
        ...(pageState.searchName ? [`search-${pageState.searchName}`] : []),
        ...(pageState.date ? [`date-${pageState.date}`] : []),
        ...(pageState.departmentId ? [`dept-${pageState.departmentId}`] : []),
      ],
    }
  )

  const [departments, listResult, monthLogs] = await Promise.all([
    fetchUserDepartments(supabase, userId, forcedDepartmentId),
    pageState.view === "list"
      ? hasGranularFilters
        ? // Skip cache for granular filters
          fetchUserLogs(supabase, user.id, {
            date: pageState.date,
            departmentId: pageState.departmentId,
            cursor:
              (rawParams as any).nextCursorDate && (rawParams as any).nextCursorId
                ? { date: (rawParams as any).nextCursorDate, id: (rawParams as any).nextCursorId }
                : null,
            limit: 30,
            canViewDepartmentLogs: effectiveCanViewDepartmentLogs,
            searchName: pageState.searchName,
            professionRoleId: pageState.professionRoleId,
            entryKind: pageState.entryKind,
          })
        : // Use cache for base queries and date-only queries
          getCachedUserLogs(user.id, {
            date: pageState.date,
            departmentId: pageState.departmentId,
            cursor:
              (rawParams as any).nextCursorDate && (rawParams as any).nextCursorId
                ? { date: (rawParams as any).nextCursorDate, id: (rawParams as any).nextCursorId }
                : null,
            limit: 30,
            canViewDepartmentLogs: effectiveCanViewDepartmentLogs,
            searchName: pageState.searchName,
            professionRoleId: pageState.professionRoleId,
            entryKind: pageState.entryKind,
          })
      : Promise.resolve({ logs: [], count: 0, hasMore: false, nextCursor: null }),
    pageState.view === "calendar"
      ? fetchLogsForMonth(supabase, userId, {
          departmentId: pageState.departmentId,
          month: pageState.month,
          canViewDepartmentLogs: effectiveCanViewDepartmentLogs,
          professionRoleId: pageState.professionRoleId,
          entryKind: pageState.entryKind,
        })
      : Promise.resolve([]),
  ])

  const departmentIdsForEntryKinds = pageState.departmentId
    ? [pageState.departmentId]
    : Array.from(
        new Set(
          (pageState.view === "list" ? listResult.logs : monthLogs)
            .map((log) => log.department_id)
            .filter((id): id is string => typeof id === "string" && id.length > 0)
        )
      )

  const entryKindConfigs = await fetchEntryKindConfigs(supabase, departmentIdsForEntryKinds)

  const flattenedList =
    pageState.view === "list"
      ? flattenLogs(listResult.logs, !pageState.date) // single-day filter => no date grouping
      : []

  const primaryDepartment = pageState.departmentId
    ? departments.find((d) => d.id === pageState.departmentId) || departments[0] || null
    : departments[0] || null
  const reportStatus = primaryDepartment ? await getReportStatus(supabase, userId, primaryDepartment.id) : null
  const viewerProfession =
    primaryDepartment && primaryDepartment.id
      ? await fetchViewerDepartmentProfession(supabase, userId, primaryDepartment.id)
      : null
  const canCreateNewReport = !!primaryDepartment
  const newReportHref =
    canCreateNewReport && primaryDepartment
      ? `/logs/new?departmentId=${encodeURIComponent(primaryDepartment.id)}${
          pageState.date ? `&date=${encodeURIComponent(pageState.date)}` : ""
        }`
      : null
  const isSalesPromoterWorkflow =
    !!primaryDepartment &&
    isMarketingDepartmentName(primaryDepartment.name) &&
    isSalesPromoterProfessionKey(viewerProfession?.profession_key)

  const hasFilters =
    !!pageState.date ||
    (!isBasicUser && !!pageState.departmentId) ||
    !!pageState.searchName ||
    !!pageState.professionRoleId ||
    !!pageState.entryKind
  const calendarDaySummaries = pageState.view === "calendar" ? summarizeCalendarDays(monthLogs) : []
  const selectedDateLogs =
    pageState.view === "calendar" && pageState.date ? monthLogs.filter((log) => log.date === pageState.date) : []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Logs</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isSalesPromoterWorkflow ? (
              listResult.count > 0 ? (
                <>
                  Showing {listResult.logs.length} of {listResult.count} call report{listResult.count === 1 ? "" : "s"}
                </>
              ) : (
                "Track one call report per assigned agent and date."
              )
            ) : reportStatus ? (
              `${reportStatus.submittedDates.length} of ${reportStatus.allowedDates.length} recent day${
                reportStatus.allowedDates.length === 1 ? "" : "s"
              } logged`
            ) : listResult.count > 0 ? (
              <>
                Showing {listResult.logs.length} of {listResult.count} entries
              </>
            ) : (
              "No entries found"
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LogsViewToggle />
          {canCreateNewReport && newReportHref ? (
            <Button asChild>
              <Link href={newReportHref}>
                <Plus className="mr-2 h-4 w-4" />
                New Log
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <LogsFilters
            currentView={pageState.view}
            date={pageState.date}
            departmentId={pageState.departmentId}
            departments={departments}
            hasFilters={hasFilters}
            isBasicUser={isBasicUser}
            month={pageState.month}
            searchName={pageState.searchName}
            professionRoleId={pageState.professionRoleId}
            entryKind={pageState.entryKind}
            professionRoles={professionRoles}
            entryKinds={entryKinds}
          />
        </CardContent>
      </Card>

      {pageState.view === "files" ? (
        <LogsFilesView
          currentUserId={userId}
          departmentId={pageState.departmentId}
          date={pageState.date}
          month={pageState.month}
        />
      ) : pageState.view === "calendar" ? (
        <div className="space-y-6">
          <LogsCalendar
            daySummaries={calendarDaySummaries}
            departmentId={pageState.departmentId}
            month={pageState.month}
            selectedDate={pageState.date}
          />

          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {pageState.date ? formatDateHuman(pageState.date) : "Select a date"}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {pageState.date
                  ? selectedDateLogs.length > 0
                    ? `${selectedDateLogs.length} log${selectedDateLogs.length === 1 ? "" : "s"} submitted on this date.`
                    : "No logs were submitted on this date."
                  : "Choose any day on the calendar to review the logs submitted for that date."}
              </p>
            </div>

            {pageState.date ? (
              <LogsList
                canViewDepartmentLogs={effectiveCanViewDepartmentLogs}
                entryKindConfigs={entryKindConfigs}
                logs={selectedDateLogs}
                emptyTitle="No logs for this date"
                emptyDescription="Pick another date on the calendar to review a different day."
              />
            ) : (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="text-muted-foreground text-sm">
                    Select a day in the calendar above to review submitted daily logs.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Ranking transition hint - shown on first page with search */}
          {pageState.searchName && !(rawParams as any).nextCursorDate && !(rawParams as any).nextCursorId && (
            <div className="mb-4 rounded-md bg-blue-50 px-4 py-2 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              Top results sorted by relevance. More results sorted by recent activity.
            </div>
          )}

          {/* Intelligent empty state when filters return no results */}
          {hasFilters && listResult.logs.length === 0 && (
            <Card>
              <CardContent className="py-6 text-center">
                <p className="text-muted-foreground text-sm">
                  No logs match your filters.
                  {pageState.professionRoleId && (
                    <span className="ml-2">
                      Profession: {professionRoles.find((r) => r.id === pageState.professionRoleId)?.label}
                    </span>
                  )}
                  {pageState.entryKind && (
                    <span className="ml-2">
                      Entry Kind: {entryKinds.find((k) => k.entry_kind === pageState.entryKind)?.label}
                    </span>
                  )}
                </p>
                {/* Suggestion logic for invalid combos */}
                {pageState.professionRoleId && pageState.entryKind && (
                  <Button variant="link" size="sm" asChild className="mt-2">
                    <Link
                      href={buildLogsPageHref({
                        view: pageState.view,
                        date: pageState.date,
                        departmentId: pageState.departmentId,
                        month: ["calendar", "files"].includes(pageState.view) ? pageState.month : undefined,
                        searchName: pageState.searchName,
                        professionRoleId: pageState.professionRoleId,
                        entryKind: undefined, // Clear entry kind
                      })}
                    >
                      Clear entry kind filter
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          <LogsList
            canViewDepartmentLogs={effectiveCanViewDepartmentLogs}
            entryKindConfigs={entryKindConfigs}
            logs={listResult.logs}
            flattenedItems={flattenedList}
            emptyTitle={pageState.searchName ? `No users found matching "${pageState.searchName}"` : "No logs found"}
            emptyDescription={
              pageState.searchName
                ? pageState.date
                  ? "Try removing the date filter to broaden results."
                  : "Try a shorter name or different spelling."
                : hasFilters
                  ? "Try adjusting your filters or clear them to see all entries."
                  : "Get started by creating your first daily log entry."
            }
            emptyActionHref={!hasFilters ? newReportHref : null}
          />

          {listResult.hasMore ? (
            <div className="flex items-center justify-center pt-4">
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={buildLogsPageHref({
                    ...pageState,
                    page: pageState.page.toString(),
                    nextCursorDate: listResult.nextCursor?.date,
                    nextCursorId: listResult.nextCursor?.id,
                  })}
                >
                  Load More
                </Link>
              </Button>
            </div>
          ) : null}
        </>
      )}

      <LogReportPreviewPanel canAccessAdmin={canAccessAdmin} reportId={pageState.selectedLogId} />
    </div>
  )
}
