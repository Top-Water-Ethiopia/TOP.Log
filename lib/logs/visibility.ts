export function normalizeDepartmentAccessLevelName(value: string | null | undefined) {
  return (value || "").trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-")
}

export function canViewDepartmentLogs(accessLevelName: string | null | undefined) {
  const normalized = normalizeDepartmentAccessLevelName(accessLevelName)
  return [
    "department-lead",
    "department-manager",
    "supervisor",
    "viewer",
    "admin",
    "super-admin",
  ].includes(normalized)
}

export function shouldRestrictLogsToOwnEntries(accessLevelName: string | null | undefined) {
  return !canViewDepartmentLogs(accessLevelName)
}
