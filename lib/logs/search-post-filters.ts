import type { LogEntry } from "@/lib/logs/types"

export function applySearchPostFilters(
  logs: LogEntry[],
  filters: { professionRoleId?: string; entryKind?: string }
): LogEntry[] {
  let filtered = logs
  if (filters.professionRoleId) {
    filtered = filtered.filter((l) => l.subject_profession_id === filters.professionRoleId)
  }
  if (filters.entryKind) {
    filtered = filtered.filter((l) => l.entry_kind === filters.entryKind)
  }
  return filtered
}

