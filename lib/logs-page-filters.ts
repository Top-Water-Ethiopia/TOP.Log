import { formatLocalDate } from "@/lib/date-restrictions"

export type LogsViewMode = "list" | "calendar" | "files"

export interface LogsPageSearchParams {
  date?: string
  departmentId?: string
  month?: string
  page?: string
  selectedReportId?: string
  view?: string
}

export interface LogsPageState {
  date?: string
  departmentId?: string
  month: string
  page: number
  selectedReportId?: string
  view: LogsViewMode
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MONTH_PATTERN = /^\d{4}-\d{2}$/

export function getCurrentMonthValue(referenceDate = new Date()): string {
  return formatLocalDate(referenceDate).slice(0, 7)
}

export function parseLogsViewMode(value?: string): LogsViewMode {
  if (value === "calendar") return "calendar"
  if (value === "files") return "files"
  return "list"
}

export function parseLogsPageNumber(value?: string): number {
  const parsed = Number.parseInt(value || "1", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export function isValidLogsDate(value?: string): value is string {
  if (!value || !DATE_PATTERN.test(value)) {
    return false
  }

  const parsed = new Date(`${value}T00:00:00`)
  return !Number.isNaN(parsed.getTime()) && formatLocalDate(parsed) === value
}

export function isValidLogsMonth(value?: string): value is string {
  if (!value || !MONTH_PATTERN.test(value)) {
    return false
  }

  const [yearValue, monthValue] = value.split("-").map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(yearValue) || !Number.isFinite(monthValue) || monthValue < 1 || monthValue > 12) {
    return false
  }

  const parsed = new Date(yearValue, monthValue - 1, 1)
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}` === value
}

export function getMonthDateRange(month: string): { endDate: string; startDate: string } {
  const [yearValue, monthValue] = month.split("-").map((part) => Number.parseInt(part, 10))
  const monthStart = new Date(yearValue, monthValue - 1, 1)
  const monthEnd = new Date(yearValue, monthValue, 0)

  return {
    startDate: formatLocalDate(monthStart),
    endDate: formatLocalDate(monthEnd),
  }
}

export function getMonthCalendarDays(month: string): Array<string | null> {
  const [yearValue, monthValue] = month.split("-").map((part) => Number.parseInt(part, 10))
  const monthStart = new Date(yearValue, monthValue - 1, 1)
  const totalDays = new Date(yearValue, monthValue, 0).getDate()
  const leadingEmptyDays = monthStart.getDay()
  const days: Array<string | null> = []

  for (let index = 0; index < leadingEmptyDays; index += 1) {
    days.push(null)
  }

  for (let day = 1; day <= totalDays; day += 1) {
    days.push(formatLocalDate(new Date(yearValue, monthValue - 1, day)))
  }

  return days
}

export function shiftMonthValue(month: string, offset: number): string {
  const [yearValue, monthValue] = month.split("-").map((part) => Number.parseInt(part, 10))
  const shiftedDate = new Date(yearValue, monthValue - 1 + offset, 1)
  return `${shiftedDate.getFullYear()}-${String(shiftedDate.getMonth() + 1).padStart(2, "0")}`
}

export function normalizeLogsPageState(params: LogsPageSearchParams): LogsPageState {
  const date = isValidLogsDate(params.date) ? params.date : undefined
  const monthFromDate = date?.slice(0, 7)
  const month = monthFromDate || (isValidLogsMonth(params.month) ? params.month : getCurrentMonthValue())
  const selectedReportId = typeof params.selectedReportId === "string" && params.selectedReportId.trim()
    ? params.selectedReportId.trim()
    : undefined

  return {
    view: parseLogsViewMode(params.view),
    date,
    departmentId: params.departmentId || undefined,
    page: parseLogsPageNumber(params.page),
    month,
    selectedReportId,
  }
}

export function buildLogsPageHref(state: {
  date?: string
  departmentId?: string
  month?: string
  page?: number
  selectedReportId?: string
  view?: LogsViewMode
}): string {
  const query = new URLSearchParams()
  const view = state.view || "list"

  if (view === "calendar") {
    query.set("view", "calendar")
  }

  if (view === "files") {
    query.set("view", "files")
  }

  if (state.date) {
    query.set("date", state.date)
  }

  if (state.departmentId) {
    query.set("departmentId", state.departmentId)
  }

  if (state.selectedReportId) {
    query.set("selectedReportId", state.selectedReportId)
  }

  if ((view === "calendar" || view === "files") && state.month && state.month !== getCurrentMonthValue()) {
    query.set("month", state.month)
  }

  if (view === "list" && state.page && state.page > 1) {
    query.set("page", String(state.page))
  }

  const queryString = query.toString()
  return queryString ? `/logs?${queryString}` : "/logs"
}
