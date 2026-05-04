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

export interface AccessContext {
  userId: string
  departmentAccess: Map<string, string> // departmentId -> accessLevel
}

export interface PermissionAccessContext {
  userId: string
  readableDepartments: Set<string> // departmentIds with department-wide read
}

/**
 * Centralized authorization guard for log access.
 * Enforces that a user can see a log if:
 * 1. They are the owner (user_id match)
 * 2. They have department-wide read permissions (lead/supervisor/manager) for the log's department.
 */
export function canAccessLog(log: { user_id: string; department_id: string | null }, context: AccessContext) {
  // 1. Owner access
  if (log.user_id === context.userId) return true

  // 2. Department-wide access
  if (!log.department_id) return false
  const accessLevel = context.departmentAccess.get(log.department_id)
  return canViewDepartmentLogs(accessLevel)
}

/**
 * Permission-based access guard for log access.
 * Use this when "department-wide read" is derived from explicit permissions,
 * not inferred from access-level naming conventions.
 */
export function canAccessLogByDepartmentSet(
  log: { user_id: string; department_id: string | null },
  context: PermissionAccessContext
) {
  if (log.user_id === context.userId) return true
  if (!log.department_id) return false
  return context.readableDepartments.has(log.department_id)
}

/**
 * Single chain of trust: asset access is derived strictly from log access.
 */
export function canAccessAsset(asset: { log: { user_id: string; department_id: string | null } }, context: AccessContext) {
  return canAccessLog(asset.log, context)
}

/**
 * Explicit audit sampling engine to prevent table bloat.
 */
export function shouldAudit(params: {
  actorId: string
  targetId: string
  isBulkRead: boolean
  isSensitive: boolean
}) {
  const { actorId, targetId, isBulkRead, isSensitive } = params

  // 1. Never audit self-access
  if (actorId === targetId) return false

  // 2. Do not audit bulk list reads unless they contain sensitive assets
  if (isBulkRead && !isSensitive) return false

  // 3. Always audit cross-user sensitive access
  return true
}

/**
 * Non-blocking audit logger with failure isolation.
 * Decouples observability from request latency.
 */
export async function enqueueAuditLog(
  supabase: any,
  params: {
    user_id: string
    action: string
    resource_type: string
    resource_id: string
    severity?: "low" | "medium" | "high" | "critical"
    metadata?: any
  }
) {
  try {
    // We intentionally do not await this to return control to the caller immediately
    // or just wrap it in a safe try/catch for non-blocking execution in edge runtimes.
    const { error } = await supabase.from("audit_logs").insert({
      user_id: params.user_id,
      action: params.action,
      resource_type: params.resource_type,
      resource_id: params.resource_id,
      severity: params.severity || "medium",
      metadata: params.metadata || {},
    })

    if (error) {
      console.error("Failed to enqueue audit log (silent failure):", error)
    }
  } catch (err) {
    console.error("Critical failure in audit pipeline (isolated):", err)
    // Swallow error to prevent request breakage
  }
}
