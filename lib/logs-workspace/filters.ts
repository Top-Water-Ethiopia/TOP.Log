import crypto from "crypto"
import { formatLocalDate } from "@/lib/date-restrictions"

export interface LogsWorkspaceSearchParams {
  dateFrom?: string
  dateTo?: string
  entryKind?: string
  nextCursorAt?: string
  nextCursorId?: string
  searchName?: string
  selectedLogId?: string
  subTeamId?: string
}

export interface LogsWorkspaceFilterState {
  dateFrom: string
  dateTo: string
  departmentId: string
  entryKind?: string
  filterHash: string
  nextCursorAt?: string
  nextCursorId?: string
  searchName?: string
  selectedLogId?: string
  subTeamId?: string
}

export interface LogsWorkspacePresetFilters {
  defaultDatePreset?: "last7"
  lockedDepartmentId: string
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isValidWorkspaceDate(value?: string): value is string {
  if (!value || !DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00`)
  return !Number.isNaN(parsed.getTime()) && formatLocalDate(parsed) === value
}

function getLast7DateRange(referenceDate = new Date()) {
  const endDate = formatLocalDate(referenceDate)
  const start = new Date(referenceDate)
  start.setDate(start.getDate() - 6)
  return { dateFrom: formatLocalDate(start), dateTo: endDate }
}

function cleanToken(value: unknown, maxLength = 80) {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLength) return undefined
  return trimmed
}

function cleanSearch(value: unknown) {
  const trimmed = cleanToken(value, 50)
  if (!trimmed || trimmed.length < 2) return undefined
  return trimmed.toLowerCase()
}

export function buildLogsWorkspaceFilterHash(state: Omit<LogsWorkspaceFilterState, "filterHash">) {
  const stablePayload = JSON.stringify({
    dateFrom: state.dateFrom,
    dateTo: state.dateTo,
    departmentId: state.departmentId,
    entryKind: state.entryKind || "",
    searchName: state.searchName || "",
    subTeamId: state.subTeamId || "",
  })
  return crypto.createHash("sha256").update(stablePayload).digest("hex").slice(0, 16)
}

export function canonicalizeLogsWorkspaceFilters(params: LogsWorkspaceSearchParams, preset: LogsWorkspacePresetFilters) {
  const fallbackRange = getLast7DateRange()
  const dateFrom = isValidWorkspaceDate(params.dateFrom) ? params.dateFrom : fallbackRange.dateFrom
  const dateTo = isValidWorkspaceDate(params.dateTo) ? params.dateTo : fallbackRange.dateTo
  const normalizedRange = dateFrom <= dateTo ? { dateFrom, dateTo } : fallbackRange

  const withoutHash: Omit<LogsWorkspaceFilterState, "filterHash"> = {
    ...normalizedRange,
    departmentId: preset.lockedDepartmentId,
    entryKind: cleanToken(params.entryKind, 80),
    nextCursorAt: cleanToken(params.nextCursorAt, 80),
    nextCursorId: cleanToken(params.nextCursorId, 80),
    searchName: cleanSearch(params.searchName),
    selectedLogId: cleanToken(params.selectedLogId, 120),
    // V1 accepts the param shape but only keeps syntactically valid values.
    // Authorization-specific sub-team pruning belongs to the server visibility layer.
    subTeamId: cleanToken(params.subTeamId, 120),
  }

  return {
    ...withoutHash,
    filterHash: buildLogsWorkspaceFilterHash(withoutHash),
  }
}

export function buildMarketingLogsHref(
  state: Partial<LogsWorkspaceSearchParams> & Pick<LogsWorkspaceFilterState, "dateFrom" | "dateTo">
) {
  const query = new URLSearchParams()
  query.set("dateFrom", state.dateFrom)
  query.set("dateTo", state.dateTo)
  if (state.entryKind) query.set("entryKind", state.entryKind)
  if (state.searchName) query.set("searchName", state.searchName)
  if (state.selectedLogId) query.set("selectedLogId", state.selectedLogId)
  if (state.nextCursorAt && state.nextCursorId) {
    query.set("nextCursorAt", state.nextCursorAt)
    query.set("nextCursorId", state.nextCursorId)
  }
  if (state.subTeamId) query.set("subTeamId", state.subTeamId)
  return `/marketing/logs?${query.toString()}`
}

