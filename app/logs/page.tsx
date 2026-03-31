import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateHuman } from "@/lib/date-restrictions"
import { getReportStatus } from "@/lib/completion-status"
import { buildLogsPageHref, getMonthDateRange, normalizeLogsPageState } from "@/lib/logs-page-filters"
import type { LogsPageSearchParams } from "@/lib/logs-page-filters"
import type { CalendarDaySummary, LogEntry } from "@/lib/logs/types"
import { LogsCalendar } from "@/components/logs/logs-calendar"
import { LogsFilters } from "@/components/logs/logs-filters"
import { LogsList } from "@/components/logs/logs-list"
import { LogReportPreviewPanel } from "@/components/logs/log-report-preview-panel"
import { LogsViewToggle } from "@/components/logs/logs-view-toggle"

interface LogsViewerProfile {
  role_id: string
  department_id: string | null
  role_name: string | null
}

interface LogRow {
  created_at: string | null
  date: string
  department_id: string | null
  departments: { name?: string } | null
  id: string
  updated_at: string | null
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
  }))
}

async function fetchUserLogs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  filters: { date?: string; departmentId?: string; page: number }
): Promise<{ count: number; hasMore: boolean; logs: LogEntry[] }> {
  const pageSize = 20
  const offset = (filters.page - 1) * pageSize

  let query = supabase
    .from("captain_log_entries")
    .select(
      `
      id,
      date,
      department_id,
      created_at,
      updated_at,
      departments:department_id (name)
    `,
      { count: "exact" }
    )
    .eq("user_id", userId)
    .order("date", { ascending: false })

  if (filters.departmentId) {
    query = query.eq("department_id", filters.departmentId)
  } else {
    const { data: userDepartments } = await supabase
      .from("user_department_professions")
      .select("department_id")
      .eq("user_id", userId)
      .eq("is_active", true)

    const accessibleDepartmentIds = userDepartments?.map((department) => department.department_id).filter(Boolean) || []

    if (accessibleDepartmentIds.length === 0) {
      return { logs: [], count: 0, hasMore: false }
    }

    query = query.in("department_id", accessibleDepartmentIds)
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
  filters: { departmentId?: string; month: string }
): Promise<LogEntry[]> {
  const { endDate, startDate } = getMonthDateRange(filters.month)

  let query = supabase
    .from("captain_log_entries")
    .select(
      `
      id,
      date,
      department_id,
      created_at,
      updated_at,
      departments:department_id (name)
    `
    )
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })

  if (filters.departmentId) {
    query = query.eq("department_id", filters.departmentId)
  } else {
    const { data: userDepartments } = await supabase
      .from("user_department_professions")
      .select("department_id")
      .eq("user_id", userId)
      .eq("is_active", true)

    const accessibleDepartmentIds = userDepartments?.map((department) => department.department_id).filter(Boolean) || []

    if (accessibleDepartmentIds.length === 0) {
      return []
    }

    query = query.in("department_id", accessibleDepartmentIds)
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

  const { data, error } = await supabase
    .from("user_department_professions")
    .select(
      `
      department_id,
      department:departments (id, name)
    `
    )
    .eq("user_id", userId)
    .eq("is_active", true)

  if (error || !data) {
    return []
  }

  return data.map((department) => ({
    id: department.department_id,
    name: (department.department as { name?: string })?.name || "Unknown",
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
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    const params = await searchParams
    const redirectHref = buildLogsPageHref(normalizeLogsPageState(params))
    redirect(`/login?redirect=${encodeURIComponent(redirectHref)}`)
  }

  const userId = session.user.id
  const rawParams = await searchParams
  const viewerProfile = await fetchViewerProfile(supabase, userId)
  const isBasicUser = viewerProfile?.role_name === "user"
  const canAccessAdmin = ["admin", "system-admin", "super-admin"].includes(viewerProfile?.role_name || "")
  const forcedDepartmentId = isBasicUser ? viewerProfile?.department_id || undefined : undefined
  const pageState = normalizeLogsPageState({
    ...rawParams,
    departmentId: forcedDepartmentId || rawParams.departmentId,
  })

  const [departments, listResult, monthLogs] = await Promise.all([
    fetchUserDepartments(supabase, userId, forcedDepartmentId),
    pageState.view === "list"
      ? fetchUserLogs(supabase, userId, {
          date: pageState.date,
          departmentId: pageState.departmentId,
          page: pageState.page,
        })
      : Promise.resolve({ logs: [], count: 0, hasMore: false }),
    pageState.view === "calendar"
      ? fetchLogsForMonth(supabase, userId, {
          departmentId: pageState.departmentId,
          month: pageState.month,
        })
      : Promise.resolve([]),
  ])

  const primaryDepartment = forcedDepartmentId
    ? departments.find((department) => department.id === forcedDepartmentId) || departments[0] || null
    : departments[0] || null
  const reportStatus = primaryDepartment ? await getReportStatus(supabase, userId, primaryDepartment.id) : null
  const canCreateNewReport = !!primaryDepartment && !!reportStatus && !reportStatus.isFullySubmitted
  const newReportHref =
    canCreateNewReport && reportStatus
      ? `/logs/new?departmentId=${encodeURIComponent(primaryDepartment.id)}&date=${encodeURIComponent(reportStatus.missingDates[0])}`
      : null

  const hasFilters = !!pageState.date || (!isBasicUser && !!pageState.departmentId)
  const calendarDaySummaries = pageState.view === "calendar" ? summarizeCalendarDays(monthLogs) : []
  const selectedDateLogs =
    pageState.view === "calendar" && pageState.date
    ? monthLogs.filter((log) => log.date === pageState.date)
    : []
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
            {reportStatus ? (
              reportStatus.isFullySubmitted ? (
                "You are all caught up for the last 3 days."
              ) : (
                `${reportStatus.missingDates.length} of ${reportStatus.allowedDates.length} report${reportStatus.missingDates.length === 1 ? "" : "s"} remaining`
              )
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

      {reportStatus?.isFullySubmitted ? (
        <Card className="border-green-500/20 bg-green-500/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle>All caught up</CardTitle>
                <CardDescription>
                  You&apos;ve submitted reports for all available dates. Review your reports below and check back tomorrow.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      ) : null}

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

      {pageState.view === "calendar" ? (
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

          {(listResult.hasMore || pageState.page > 1) ? (
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
