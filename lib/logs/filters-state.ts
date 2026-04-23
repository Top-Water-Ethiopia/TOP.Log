import type { LogsPageState } from "@/lib/logs-page-filters"

export type LogsFiltersDraft = {
  view: LogsPageState["view"]
  month: string
  date?: string
  departmentId?: string
  professionRoleId?: string
  entryKind?: string
  searchRaw?: string
}

export type LogsFiltersSnapshot = {
  view: LogsPageState["view"]
  month: string
  date?: string
  departmentId?: string
  professionRoleId?: string
  entryKind?: string
  searchName?: string
}

export const FILTER_KEYS: Array<keyof LogsFiltersSnapshot> = [
  "departmentId",
  "professionRoleId",
  "entryKind",
  "searchName",
  "date",
  "month",
  "view",
]

export function normalizeSearch(raw?: string): string | undefined {
  const trimmed = (raw || "").trim().toLowerCase()
  if (!trimmed) return undefined
  if (trimmed.length < 2 || trimmed.length > 50) return undefined
  return trimmed
}

export function normalizeDraft(draft: LogsFiltersDraft): LogsFiltersSnapshot {
  return {
    view: draft.view,
    month: draft.month,
    date: draft.date || undefined,
    departmentId: draft.departmentId || undefined,
    professionRoleId: draft.professionRoleId || undefined,
    entryKind: draft.entryKind || undefined,
    searchName: normalizeSearch(draft.searchRaw),
  }
}

export function normalizeApplied(state: LogsPageState): LogsFiltersSnapshot {
  return {
    view: state.view,
    month: state.month,
    date: state.date || undefined,
    departmentId: state.departmentId || undefined,
    professionRoleId: state.professionRoleId || undefined,
    entryKind: state.entryKind || undefined,
    searchName: normalizeSearch(state.searchName),
  }
}

export function pickFilterKeys(snapshot: LogsFiltersSnapshot): Partial<LogsFiltersSnapshot> {
  const picked: Partial<LogsFiltersSnapshot> = {}
  FILTER_KEYS.forEach((key) => {
    picked[key] = snapshot[key]
  })
  return picked
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`
  }

  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`
}

export function toSnapshotKey(snapshot: LogsFiltersSnapshot): string {
  return stableStringify(pickFilterKeys(snapshot))
}

export function isDepartmentApplied(draft: LogsFiltersSnapshot, applied: LogsFiltersSnapshot): boolean {
  return (draft.departmentId || "") === (applied.departmentId || "")
}

