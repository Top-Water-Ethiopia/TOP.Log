export function normalizeDepartmentAccessLevelName(value: string | null | undefined) {
  return (value || "").trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-")
}

export function canViewDepartmentLogs(accessLevelName: string | null | undefined) {
  return normalizeDepartmentAccessLevelName(accessLevelName) === "department-lead"
}

export function shouldRestrictLogsToOwnEntries(accessLevelName: string | null | undefined) {
  return !canViewDepartmentLogs(accessLevelName)
}
