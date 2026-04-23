import { formatLocalDate } from "@/lib/date-restrictions"
import { z } from "zod"

export type LogsViewMode = "list" | "calendar" | "files"

export interface LogsPageSearchParams {
  date?: string
  departmentId?: string
  month?: string
  page?: string
  nextCursorDate?: string
  nextCursorId?: string
  selectedLogId?: string
  searchName?: string
  view?: string
  professionRoleId?: string
  entryKind?: string
}

export interface LogsPageState {
  date?: string
  departmentId?: string
  month: string
  page: number
  searchName?: string
  selectedLogId?: string
  view: LogsViewMode
  nextCursorDate?: string
  nextCursorId?: string
  professionRoleId?: string
  entryKind?: string
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MONTH_PATTERN = /^\d{4}-\d{2}$/

// Zod schema for runtime validation
export const LogsPageStateSchema = z.object({
  date: z.string().optional(),
  departmentId: z.string().optional(),
  month: z.string(),
  page: z.number().int().positive(),
  searchName: z.string().optional(),
  selectedLogId: z.string().optional(),
  view: z.enum(["list", "calendar", "files"]),
  nextCursorDate: z.string().optional(),
  nextCursorId: z.string().optional(),
  professionRoleId: z.string().optional(),
  entryKind: z.string().optional(),
})

// Helper to assert complete state (defensive check)
export function assertCompleteState(state: LogsPageState): asserts state is Required<LogsPageState> {
  if (!state.month) throw new Error("LogsPageState missing required field: month")
  if (!state.view) throw new Error("LogsPageState missing required field: view")
  if (typeof state.page !== "number" || state.page < 1) {
    throw new Error("LogsPageState invalid field: page")
  }
}

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

export function parseLogsPageState(params: LogsPageSearchParams): LogsPageState {
  const date = isValidLogsDate(params.date) ? params.date : undefined
  const monthFromDate = date?.slice(0, 7)
  const month = monthFromDate || (isValidLogsMonth(params.month) ? params.month : getCurrentMonthValue())
  const selectedLogId =
    typeof params.selectedLogId === "string" && params.selectedLogId.trim() ? params.selectedLogId.trim() : undefined

  let searchName: string | undefined
  if (typeof params.searchName === "string" && params.searchName.trim()) {
    const trimmed = params.searchName.trim().toLowerCase()
    if (trimmed.length >= 2 && trimmed.length <= 50) {
      searchName = trimmed
    }
  }

  return {
    view: parseLogsViewMode(params.view),
    date,
    departmentId: params.departmentId || undefined,
    page: parseLogsPageNumber(params.page),
    month,
    searchName,
    selectedLogId,
    // Preserve cursor params if present
    nextCursorDate: params.nextCursorDate,
    nextCursorId: params.nextCursorId,
    // New filter params
    professionRoleId: params.professionRoleId || undefined,
    entryKind: params.entryKind || undefined,
  }
}

// Backward compatibility alias
export function normalizeLogsPageState(params: LogsPageSearchParams): LogsPageState {
  return parseLogsPageState(params)
}

export function buildLogsPageHrefFromState(state: Required<LogsPageState>): string {
  // Runtime validation with zod
  LogsPageStateSchema.parse(state)

  // Defensive check
  assertCompleteState(state)

  const query = new URLSearchParams()
  const view = state.view

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

  if (state.searchName) {
    query.set("searchName", state.searchName)
  }

  // Support new naming
  if (state.selectedLogId) {
    query.set("selectedLogId", state.selectedLogId)
  }

  // New filter params
  if (state.professionRoleId) {
    query.set("professionRoleId", state.professionRoleId)
  }

  if (state.entryKind) {
    query.set("entryKind", state.entryKind)
  }

  if ((view === "calendar" || view === "files") && state.month && state.month !== getCurrentMonthValue()) {
    query.set("month", state.month)
  }

  if (view === "list" && state.nextCursorDate && state.nextCursorId) {
    query.set("nextCursorDate", state.nextCursorDate)
    query.set("nextCursorId", state.nextCursorId)
  }

  const queryString = query.toString()
  return queryString ? `/logs?${queryString}` : "/logs"
}

// Backward compatibility alias (will be removed after migration)
export function buildLogsPageHref(state: {
  date?: string
  departmentId?: string
  month?: string
  page?: string
  nextCursorDate?: string
  nextCursorId?: string
  searchName?: string
  selectedLogId?: string
  view?: LogsViewMode
  professionRoleId?: string
  entryKind?: string
}): string {
  return buildLogsPageHrefFromState({
    date: state.date || "",
    departmentId: state.departmentId || "",
    month: state.month || getCurrentMonthValue(),
    page: state.page ? Number.parseInt(state.page, 10) : 1,
    searchName: state.searchName || "",
    selectedLogId: state.selectedLogId || "",
    view: state.view || "list",
    nextCursorDate: state.nextCursorDate || "",
    nextCursorId: state.nextCursorId || "",
    professionRoleId: state.professionRoleId || "",
    entryKind: state.entryKind || "",
  })
}
