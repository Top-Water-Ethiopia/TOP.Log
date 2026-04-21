import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatDateHuman } from "@/lib/date-restrictions"
import { getReportStatus } from "@/lib/completion-status"
import { buildLogsPageHref, getMonthDateRange, normalizeLogsPageState } from "@/lib/logs-page-filters"
import type { LogsPageSearchParams } from "@/lib/logs-page-filters"
import type { CalendarDaySummary, LogEntry } from "@/lib/logs/types"
import { canViewDepartmentLogs } from "@/lib/logs/visibility"
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
  subject_agent_snapshot?: unknown
  updated_at: string | null
}

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

  if (error) {
    return []
  }

  return Array.from(
    new Set(
      (memberships || [])
        .map((m) => m.department_id)
        .filter((departmentId): departmentId is string => typeof departmentId === "string" && departmentId.length > 0)
    )
  )
}

async function mapRowsToLogs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: LogRow[] | null | undefined
): Promise<LogEntry[]> {
  const data = rows || []
  if (data.length === 0) {
    return []
  }

  const logIds = data.map((row) => row.id)
  const { data: responses } = await supabase.from("custom_responses").select("entry_id").in("entry_id", logIds)

  const responseCounts = new Map<string, number>()
  responses?.forEach((response) => {
    responseCounts.set(response.entry_id, (responseCounts.get(response.entry_id) || 0) + 1)
  })

  return data.map((entry) => ({
    id: entry.id,
    date: entry.date,
    department_id: entry.department_id,
    department_name: entry.departments?.name || "Unknown",
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    response_count: responseCounts.get(entry.id) || 0,
    entry_kind: entry.entry_kind === "agent_call" ? "agent_call" : "standard",
    subject_agent_name: getAgentSnapshotName(entry.subject_agent_snapshot),
    subject_agent_snapshot:
      typeof entry.subject_agent_snapshot === "object" && entry.subject_agent_snapshot !== null
        ? (entry.subject_agent_snapshot as LogEntry["subject_agent_snapshot"])
        : null,
  }))
}

async function fetchUserLogs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  filters: { date?: string; departmentId?: string; page: number; canViewDepartmentLogs?: boolean }
): Promise<{ count: number; hasMore: boolean; logs: LogEntry[] }> {
  const pageSize = 20
  const offset = (filters.page - 1) * pageSize

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
      subject_agent_snapshot,
      departments:subject_department_id (name)
    `,
      { count: "exact" }
    )
    .order("date", { ascending: false })

  if (!filters.canViewDepartmentLogs) {
    query = query.eq("user_id", userId)
  }

  if (filters.departmentId) {
    query = query.eq("subject_department_id", filters.departmentId)
  } else {
    const accessibleDepartmentIds = await fetchAccessibleDepartmentIds(supabase, userId)

    if (accessibleDepartmentIds.length === 0) {
      return { logs: [], count: 0, hasMore: false }
    }

    query = query.in("subject_department_id", accessibleDepartmentIds)
  }

  if (filters.date) {
    query = query.eq("date", filters.date)
  }

  const { data, error, count } = await query.range(offset, offset + pageSize - 1)

  if (error) {
    console.error("Error fetching logs:", error)
    return { logs: [], count: 0, hasMore: false }
  }

  const logs = await mapRowsToLogs(supabase, (data as LogRow[] | null | undefined) || [])
  const totalCount = count || 0

  return {
    logs,
    count: totalCount,
    hasMore: offset + logs.length < totalCount,
  }
}

async function fetchLogsForMonth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  filters: { departmentId?: string; month: string; canViewDepartmentLogs?: boolean }
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
      subject_agent_snapshot,
      departments:subject_department_id (name)
    `
    )
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })

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

  const { data, error } = await query

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
    const redirectHref = buildLogsPageHref(normalizeLogsPageState(params))
    redirect(`/login?redirect=${encodeURIComponent(redirectHref)}`)
  }

  const userId = user.id
  const rawParams = await searchParams
  const viewerProfile = await fetchViewerProfile(supabase, userId)
  const accessMap = await fetchUserDepartmentAccessLevels(supabase, userId)
  
  // A user is "basic" only if they don't have lead/manager permissions in any department
  const hasAnyLeadPermission = Array.from(accessMap.values()).some(role => canViewDepartmentLogs(role))
  const canAccessAdmin = ["admin", "system-admin", "super-admin"].includes(viewerProfile?.role_name || "")
  const isBasicUser = !canAccessAdmin && !hasAnyLeadPermission

  const forcedDepartmentId = isBasicUser ? viewerProfile?.department_id || undefined : undefined
  const pageState = normalizeLogsPageState({
    ...rawParams,
    departmentId: forcedDepartmentId || rawParams.departmentId,
  })
  
  // Resolve visibility: if we have a specific department, check its access.
  // If no department selected but user is a lead in some departments,
  // allow broad visibility for fetch calls (API will filter by accessible departments).
  const viewerDepartmentAccess = await fetchViewerDepartmentAccess(accessMap, pageState.departmentId)
  const effectiveCanViewDepartmentLogs = viewerDepartmentAccess.can_view_department_logs || (!pageState.departmentId && hasAnyLeadPermission)

  const [departments, listResult, monthLogs] = await Promise.all([
    fetchUserDepartments(supabase, userId, forcedDepartmentId),
    pageState.view === "list"
      ? fetchUserLogs(supabase, userId, {
          date: pageState.date,
          departmentId: pageState.departmentId,
          page: pageState.page,
          canViewDepartmentLogs: effectiveCanViewDepartmentLogs,
        })
      : Promise.resolve({ logs: [], count: 0, hasMore: false }),
    pageState.view === "calendar"
      ? fetchLogsForMonth(supabase, userId, {
          departmentId: pageState.departmentId,
          month: pageState.month,
          canViewDepartmentLogs: effectiveCanViewDepartmentLogs,
        })
      : Promise.resolve([]),
  ])

  const primaryDepartment = pageState.departmentId 
    ? departments.find(d => d.id === pageState.departmentId) || departments[0] || null
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

  const hasFilters = !!pageState.date || (!isBasicUser && !!pageState.departmentId)
  const calendarDaySummaries = pageState.view === "calendar" ? summarizeCalendarDays(monthLogs) : []
  const selectedDateLogs =
    pageState.view === "calendar" && pageState.date ? monthLogs.filter((log) => log.date === pageState.date) : []
  const previewCloseHref = buildLogsPageHref({
    view: pageState.view,
    date: pageState.date,
    departmentId: pageState.departmentId,
    month: pageState.month,
    page: pageState.view === "list" ? pageState.page : undefined,
  })

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
          <LogsViewToggle
            currentView={pageState.view}
            date={pageState.date}
            departmentId={pageState.departmentId}
            month={pageState.month}
          />
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
          />
        </CardContent>
      </Card>

      {pageState.view === "files" ? (
        <LogsFilesView currentUserId={userId} departmentId={pageState.departmentId} date={pageState.date} month={pageState.month} />
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
                logs={selectedDateLogs}
                emptyTitle="No logs for this date"
                emptyDescription="Pick another date on the calendar to review a different day."
                previewView="calendar"
                previewDate={pageState.date}
                previewDepartmentId={pageState.departmentId}
                previewMonth={pageState.month}
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
          <LogsList
            logs={listResult.logs}
            emptyTitle="No logs found"
            emptyDescription={
              hasFilters
                ? "Try adjusting your filters or clear them to see all entries."
                : "Get started by creating your first daily log entry."
            }
            emptyActionHref={!hasFilters ? newReportHref : null}
            previewView="list"
            previewDate={pageState.date}
            previewDepartmentId={pageState.departmentId}
            previewPage={pageState.page}
          />

          {listResult.hasMore || pageState.page > 1 ? (
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={pageState.page <= 1} asChild={pageState.page > 1}>
                {pageState.page > 1 ? (
                  <Link
                    href={buildLogsPageHref({
                      view: "list",
                      date: pageState.date,
                      departmentId: pageState.departmentId,
                      page: pageState.page - 1,
                    })}
                  >
                    Previous
                  </Link>
                ) : (
                  "Previous"
                )}
              </Button>
              <span className="text-muted-foreground text-sm">Page {pageState.page}</span>
              <Button variant="outline" size="sm" disabled={!listResult.hasMore} asChild={listResult.hasMore}>
                {listResult.hasMore ? (
                  <Link
                    href={buildLogsPageHref({
                      view: "list",
                      date: pageState.date,
                      departmentId: pageState.departmentId,
                      page: pageState.page + 1,
                    })}
                  >
                    Next
                  </Link>
                ) : (
                  "Next"
                )}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <LogReportPreviewPanel
        canAccessAdmin={canAccessAdmin}
        closeHref={previewCloseHref}
        reportId={pageState.selectedReportId}
      />
    </div>
  )
}
