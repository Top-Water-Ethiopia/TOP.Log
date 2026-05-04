import { verifyPermissionForDepartmentFromRequest, verifyPermissionFromRequest } from "./server"

/**
 * AuthorizationError is thrown when a permission check fails.
 * It carries a 401 or 403 status code for API responses.
 */
export class AuthorizationError extends Error {
  status: number
  code: string

  constructor(message: string, status = 403, code = "ACCESS_DENIED") {
    super(message)
    this.name = "AuthorizationError"
    this.status = status
    this.code = code
  }
}

/**
 * Centralized authorization service for the platform.
 * Enforces a "fail-closed" security posture.
 */
export async function requirePermission(
  request: Request, 
  permission: string, 
  departmentId?: string
) {
  const result = departmentId 
    ? await verifyPermissionForDepartmentFromRequest(request, permission, departmentId)
    : await verifyPermissionFromRequest(request, permission)

  if (!result.ok) {
    // Audit logging could be added here in the future
    throw new AuthorizationError(
      result.error || "Access denied", 
      result.status || 403,
      result.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN"
    )
  }

  return result
}

/**
 * Ensures the user has at least one of the provided permissions.
 */
export async function requireAnyPermission(
  request: Request,
  permissions: string[],
  departmentId?: string
) {
  for (const permission of permissions) {
    try {
      return await requirePermission(request, permission, departmentId)
    } catch (e) {
      if (e instanceof AuthorizationError && e.status === 401) throw e // Don't swallow 401s
      continue
    }
  }

  throw new AuthorizationError("Access denied: None of the required permissions were met", 403, "FORBIDDEN")
}
