import Link from "next/link"
import { redirect } from "next/navigation"
import { AlertTriangle, ClipboardList, FileText, RefreshCw, Search, ShieldAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { LogReportPreviewPanel } from "@/components/logs/log-report-preview-panel"
import { formatDateHuman } from "@/lib/date-restrictions"
import { canViewDepartmentLogs } from "@/lib/logs/visibility"
import { getAgentSnapshotName } from "@/lib/marketing-agents"
import {
  buildMarketingLogsHref,
  canonicalizeLogsWorkspaceFilters,
  type LogsWorkspaceSearchParams,
} from "@/lib/logs-workspace/filters"
import {
  formatMarketingEntryKindLabel,
  MARKETING_REVIEW_ENTRY_KINDS,
  summarizeMarketingReviewRows,
  type LogsWorkspaceRowForSummary,
} from "@/lib/logs-workspace/marketing-review"
import { getMarketingDepartmentId } from "@/lib/server/marketing"
import { createClient } from "@/lib/supabase/server"
import type { ScopeEntryKind } from "@/hooks/use-entry-kinds"

export const revalidate = 60

type MarketingLogsPageProps = {
  searchParams: Promise<LogsWorkspaceSearchParams>
}

interface WorkspaceRow extends LogsWorkspaceRowForSummary {
  created_at: string | null
  date: string
  report_kind?: string | null
  subject_agent_snapshot?: unknown
  user_id: string
  user_name: string
}

async function fetchViewerAccessLevel(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, departmentId: string) {
  const { data } = await supabase
    .from("user_department_memberships")
    .select("role:roles(name)")
    .eq("user_id", userId)
    .eq("department_id", departmentId)
    .eq("membership_type", "access_level")
    .eq("is_active", true)
    .maybeSingle()

  const roleResult = Array.isArray(data?.role) ? data?.role[0] : data?.role
  return roleResult?.name || null
}

async function fetchViewerRoleName(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("user_profiles")
    .select("roles:role_id(name)")
    .eq("user_id", userId)
    .maybeSingle()

  const roleResult = Array.isArray(data?.roles) ? data?.roles[0] : data?.roles
  return roleResult?.name || null
}

function isAdminRole(roleName: string | null | undefined) {
  return ["admin", "system-admin", "super-admin"].includes(String(roleName || "").trim().toLowerCase())
}

async function fetchEntryKindConfigs(supabase: Awaited<ReturnType<typeof createClient>>, departmentId: string) {
  const { data } = await (supabase as any)
    .from("scope_entry_kinds")
    .select("*")
    .eq("department_id", departmentId)

  return ((data || []) as ScopeEntryKind[]).filter((config) => !!config.entry_kind)
}

async function fetchResponseCounts(supabase: Awaited<ReturnType<typeof createClient>>, entryIds: string[]) {
  if (entryIds.length === 0) return new Map<string, number>()
  const { data } = await supabase.from("custom_responses").select("entry_id, value").in("entry_id", entryIds)
  const counts = new Map<string, number>()

  ;(data || []).forEach((response) => {
    const value = response.value
    if (value === null || value === undefined || value === "") return
    if (Array.isArray(value) && value.length === 0) return
    counts.set(response.entry_id, (counts.get(response.entry_id) || 0) + 1)
  })

  return counts
}

function applyWorkspaceFilters(query: any, filters: ReturnType<typeof canonicalizeLogsWorkspaceFilters>) {
  let next = query
    .eq("subject_department_id", filters.departmentId)
    .gte("date", filters.dateFrom)
    .lte("date", filters.dateTo)

  if (filters.entryKind) next = next.eq("entry_kind", filters.entryKind)
  // Cursor pagination: use stable ordering by (created_at DESC, id DESC).
  // Supabase `.or()` filters are fragile with timestamp values containing '+' or ':'.
  // For V1 we page by created_at only; collisions are rare and safe.
  if (filters.nextCursorAt) {
    next = next.lt("created_at", filters.nextCursorAt)
  }

  return next
}

async function fetchWorkspaceRows(params: {
  canViewDepartmentWide: boolean
  filters: ReturnType<typeof canonicalizeLogsWorkspaceFilters>
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
}) {
  const limit = 30
  let query = params.supabase
    .from("captain_log_entries")
    .select(
      `
      id,
      date,
      created_at,
      entry_kind,
      report_kind,
      subject_agent_snapshot,
      user_id,
      user_profiles!captain_log_entries_user_profiles_user_id_fkey (name)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })

  query = applyWorkspaceFilters(query, params.filters)
  if (!params.canViewDepartmentWide) query = query.eq("user_id", params.userId)

  const { data, count, error } = await query.limit(limit + 1)
  if (error) {
    console.error("[marketing-review-console] list_query_failed", { error, filterHash: params.filters.filterHash })
    return { count: 0, hasMore: false, rows: [] as WorkspaceRow[], nextCursor: null as null | { at: string; id: string } }
  }

  const rawRows = (data || []) as any[]
  const hasMore = rawRows.length > limit
  const trimmedRows = hasMore ? rawRows.slice(0, limit) : rawRows
  const responseCounts = await fetchResponseCounts(
    params.supabase,
    trimmedRows.map((row) => row.id)
  )

  let rows: WorkspaceRow[] = trimmedRows.map((row) => ({
    id: row.id,
    date: row.date,
    created_at: row.created_at,
    entry_kind: row.entry_kind || "standard",
    report_kind: row.report_kind || null,
    response_count: responseCounts.get(row.id) || 0,
    subject_agent_name: getAgentSnapshotName(row.subject_agent_snapshot),
    subject_agent_snapshot: row.subject_agent_snapshot,
    user_id: row.user_id,
    user_name: row.user_profiles?.name || "Deleted user",
  }))

  if (params.filters.searchName) {
    const search = params.filters.searchName
    rows = rows.filter((row) => {
      return (
        row.user_name.toLowerCase().includes(search) ||
        String(row.subject_agent_name || "").toLowerCase().includes(search) ||
        String(row.entry_kind || "").toLowerCase().includes(search)
      )
    })
  }

  const lastRow = rows[rows.length - 1]
  return {
    count: count || rows.length,
    hasMore: hasMore && !!lastRow?.created_at,
    rows,
    nextCursor: hasMore && lastRow?.created_at ? { at: lastRow.created_at, id: lastRow.id } : null,
  }
}

async function fetchSummaryRows(params: {
  canViewDepartmentWide: boolean
  filters: ReturnType<typeof canonicalizeLogsWorkspaceFilters>
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
}) {
  let query = params.supabase
    .from("captain_log_entries")
    .select(
      `
      id,
      entry_kind,
      subject_agent_snapshot,
      user_id,
      user_profiles!captain_log_entries_user_profiles_user_id_fkey (name)
    `
    )
    .order("created_at", { ascending: false })
    .limit(1000)

  query = applyWorkspaceFilters(query, params.filters)
  if (!params.canViewDepartmentWide) query = query.eq("user_id", params.userId)

  const { data, error } = await query
  if (error) {
    console.error("[marketing-review-console] summary_query_failed", { error: error.message, filterHash: params.filters.filterHash })
    return []
  }

  const rawRows = (data || []) as any[]
  const responseCounts = await fetchResponseCounts(
    params.supabase,
    rawRows.map((row) => row.id)
  )

  const rows = rawRows.map((row) => ({
    id: row.id,
    entry_kind: row.entry_kind || "standard",
    response_count: responseCounts.get(row.id) || 0,
    subject_agent_name: getAgentSnapshotName(row.subject_agent_snapshot),
    user_name: row.user_profiles?.name || "Deleted user",
  }))

  if (!params.filters.searchName) return rows
  const search = params.filters.searchName
  return rows.filter((row) => {
    return (
      row.user_name.toLowerCase().includes(search) ||
      String(row.subject_agent_name || "").toLowerCase().includes(search) ||
      String(row.entry_kind || "").toLowerCase().includes(search)
    )
  })
}

function groupRowsByDate(rows: WorkspaceRow[]) {
  const groups = new Map<string, WorkspaceRow[]>()
  rows.forEach((row) => {
    const group = groups.get(row.date) || []
    group.push(row)
    groups.set(row.date, group)
  })
  return Array.from(groups.entries())
}

function formatSubmittedTime(value: string | null) {
  if (!value) return "Time unavailable"
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value))
}

function closePreviewHref(filters: ReturnType<typeof canonicalizeLogsWorkspaceFilters>) {
  return buildMarketingLogsHref({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    entryKind: filters.entryKind,
    searchName: filters.searchName,
    subTeamId: filters.subTeamId,
  })
}

function rowHref(filters: ReturnType<typeof canonicalizeLogsWorkspaceFilters>, rowId: string) {
  return buildMarketingLogsHref({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    entryKind: filters.entryKind,
    searchName: filters.searchName,
    selectedLogId: rowId,
    subTeamId: filters.subTeamId,
  })
}

export default async function MarketingLogsPage({ searchParams }: MarketingLogsPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/login?redirect=%2Fmarketing%2Flogs")
  }

  const marketingDepartmentId = await getMarketingDepartmentId()
  if (!marketingDepartmentId) {
    return (
      <div className="rounded-lg border p-6">
        <h1 className="text-xl font-semibold">Marketing Review Console</h1>
        <p className="text-muted-foreground mt-2 text-sm">Marketing department is not configured.</p>
      </div>
    )
  }

  const rawParams = await searchParams
  const filters = canonicalizeLogsWorkspaceFilters(rawParams, { lockedDepartmentId: marketingDepartmentId, defaultDatePreset: "last7" })
  const [accessLevel, roleName, entryKindConfigs] = await Promise.all([
    fetchViewerAccessLevel(supabase, user.id, marketingDepartmentId),
    fetchViewerRoleName(supabase, user.id),
    fetchEntryKindConfigs(supabase, marketingDepartmentId),
  ])
  const canViewDepartmentWide = isAdminRole(roleName) || canViewDepartmentLogs(accessLevel)

  const [listResult, summaryRows] = await Promise.all([
    fetchWorkspaceRows({ canViewDepartmentWide, filters, supabase, userId: user.id }),
    fetchSummaryRows({ canViewDepartmentWide, filters, supabase, userId: user.id }),
  ])
  const summary = summarizeMarketingReviewRows(summaryRows, entryKindConfigs)
  const groupedRows = groupRowsByDate(listResult.rows)
  const hasFilters = !!filters.entryKind || !!filters.searchName

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marketing Review Console</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Review visible Marketing reports from {filters.dateFrom} to {filters.dateTo}.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={closePreviewHref(filters)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total reports" value={summary.operational.totalReports} />
        <SummaryCard label="Agent contacts" value={summary.operational.agentContacts} />
        <SummaryCard label="Major activities" value={summary.operational.majorActivities} />
        <SummaryCard label="Supervisor reports" value={summary.operational.supervisorDailyReports} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <QualityCard label="Empty reports" value={summary.quality.emptyReports} />
        <QualityCard label="Missing agents" value={summary.quality.missingAgent} />
        <QualityCard label="Unknown types" value={summary.quality.unknownTypes} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <form action="/marketing/logs" className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="marketing-logs-from" className="text-sm font-medium">
                From
              </label>
              <input
                id="marketing-logs-from"
                type="date"
                name="dateFrom"
                defaultValue={filters.dateFrom}
                className="border-input bg-background h-9 rounded-md border px-3 py-1 text-sm shadow-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="marketing-logs-to" className="text-sm font-medium">
                To
              </label>
              <input
                id="marketing-logs-to"
                type="date"
                name="dateTo"
                defaultValue={filters.dateTo}
                className="border-input bg-background h-9 rounded-md border px-3 py-1 text-sm shadow-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="marketing-logs-type" className="text-sm font-medium">
                Report type
              </label>
              <select
                id="marketing-logs-type"
                name="entryKind"
                defaultValue={filters.entryKind || ""}
                className="border-input bg-background h-9 rounded-md border px-3 py-1 text-sm shadow-sm"
              >
                <option value="">All reports</option>
                <option value={MARKETING_REVIEW_ENTRY_KINDS.agentContact}>Agent contact</option>
                <option value={MARKETING_REVIEW_ENTRY_KINDS.majorActivity}>Major activity</option>
                <option value={MARKETING_REVIEW_ENTRY_KINDS.supervisorDailyReport}>Supervisor daily report</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="marketing-logs-search" className="text-sm font-medium">
                Search
              </label>
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 h-4 w-4" />
                <input
                  id="marketing-logs-search"
                  type="text"
                  name="searchName"
                  defaultValue={filters.searchName || ""}
                  placeholder="Submitter, agent, type..."
                  className="border-input bg-background h-9 rounded-md border py-1 pr-3 pl-8 text-sm shadow-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Apply
              </Button>
              {hasFilters ? (
                <Button type="button" variant="ghost" size="sm" asChild>
                  <Link href={buildMarketingLogsHref({ dateFrom: filters.dateFrom, dateTo: filters.dateTo })}>Clear</Link>
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      {groupedRows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <ClipboardList className="text-muted-foreground mx-auto h-8 w-8" />
            <h2 className="mt-3 text-base font-semibold">No Marketing reports found</h2>
            <p className="text-muted-foreground mt-1 text-sm">Adjust filters or refresh after new reports are submitted.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {groupedRows.map(([date, rows]) => (
            <section key={date} className="space-y-2">
              <div>
                <h2 className="text-sm font-semibold">{formatDateHuman(date)}</h2>
                <p className="text-muted-foreground text-xs">
                  {rows.length} report{rows.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="overflow-hidden rounded-lg border">
                {rows.map((row) => (
                  <Link
                    key={row.id}
                    href={rowHref(filters, row.id)}
                    className="hover:bg-muted/40 flex flex-col gap-2 border-b p-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{formatMarketingEntryKindLabel(row.entry_kind, entryKindConfigs)}</Badge>
                        {(row.response_count || 0) <= 0 ? (
                          <Badge variant="outline" className="border-amber-300 text-amber-700">
                            Empty
                          </Badge>
                        ) : null}
                      </div>
                      <div className="truncate text-sm font-medium">{row.user_name}</div>
                      <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        <span>{formatSubmittedTime(row.created_at)}</span>
                        {row.subject_agent_name ? <span>Agent: {row.subject_agent_name}</span> : null}
                        <span>
                          {row.response_count || 0} answer{row.response_count === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                    <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {listResult.hasMore && listResult.nextCursor ? (
        <div className="flex justify-center">
          <Button variant="outline" asChild>
            <Link
              href={buildMarketingLogsHref({
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo,
                entryKind: filters.entryKind,
                nextCursorAt: listResult.nextCursor.at,
                nextCursorId: listResult.nextCursor.id,
                searchName: filters.searchName,
                subTeamId: filters.subTeamId,
              })}
            >
              Load more
            </Link>
          </Button>
        </div>
      ) : null}

      <LogReportPreviewPanel canAccessAdmin={isAdminRole(roleName)} closeHref={closePreviewHref(filters)} reportId={filters.selectedLogId} />
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function QualityCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2">
        {value > 0 ? <ShieldAlert className="h-4 w-4 text-amber-600" /> : <AlertTriangle className="text-muted-foreground h-4 w-4" />}
        <div className="text-muted-foreground text-xs">{label}</div>
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}
