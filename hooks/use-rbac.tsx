"use client"

import { useCallback, useMemo } from "react"
import useSWR from "swr"
import { useSupabaseAuth } from "@/contexts/supabase-auth-context"
import type { User, Role, PermissionCheck, CustomQuestion, RoleQuestionSet } from "@/lib/rbac/types"
import { ROLE_HIERARCHY, DEFAULT_ROLES } from "@/lib/rbac/types"
import { apiFetch } from "@/lib/api-client"
import {
  hasPermission,
  canPerformAction,
  canManageUser,
  getUserPermissions,
  getRoleByName,
  getAssignableRoles,
  getQuestionsForUser,
  getQuestionSetForRole,
  getAllQuestionSets,
  saveQuestionSet,
  validateQuestionResponse,
  processQuestionResponses,
  createQuestionResponse,
  initializeDefaultQuestionSets,
  initializeDefaultOrgStructures,
  getAllDepartments,
  getAllAccessScopes,
} from "@/lib/rbac/utils"
import { loadFromStorage } from "@/lib/rbac/utils"

// ==================== RBAC HOOK ====================

import { mapSupabaseUserToRbacUser } from "@/lib/supabase/user-mapping"

export function useRBAC() {
  const { user: supabaseUser, profile } = useSupabaseAuth()
  const user = useMemo(() => mapSupabaseUserToRbacUser(supabaseUser, profile), [supabaseUser, profile])

  const rbacKey = supabaseUser ? (["/api/rbac/me", supabaseUser.id] as const) : null
  const {
    data: rbacResponse,
    error: rbacError,
    isLoading: rbacLoading,
  } = useSWR<{ role: { name: string }; permissions: string[] }>(
    rbacKey,
    ([url]) => apiFetch<{ role: { name: string }; permissions: string[] }>(url),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  )

  const dbRbac = useMemo(() => {
    if (!supabaseUser) {
      return { loading: false, checked: false, loaded: false, permissions: [], roleName: null }
    }

    if (rbacLoading) {
      return { loading: true, checked: false, loaded: false, permissions: [], roleName: null }
    }

    if (rbacError || !rbacResponse) {
      return { loading: false, checked: true, loaded: false, permissions: [], roleName: null }
    }

    return {
      loading: false,
      checked: true,
      loaded: true,
      permissions: Array.isArray(rbacResponse.permissions) ? rbacResponse.permissions : [],
      roleName: typeof rbacResponse.role?.name === "string" ? rbacResponse.role.name : null,
    }
  }, [supabaseUser, rbacError, rbacLoading, rbacResponse])

  // Load roles from storage (normalize missing access scopes)
  // Always fallback to DEFAULT_ROLES to ensure permissions work even if localStorage is empty
  const roles: Role[] = useMemo(() => {
    const stored = loadFromStorage("ROLES", [] as Role[])
    const baseRoles = stored && stored.length > 0 ? stored : DEFAULT_ROLES
    const mergedRoles =
      stored && stored.length > 0
        ? [...baseRoles, ...DEFAULT_ROLES.filter((r) => !baseRoles.some((b) => b.name === r.name))]
        : baseRoles
    return mergedRoles.map((role) => ({
      ...role,
      accessScopes: role.accessScopes ?? [],
    }))
  }, [])

  const { departments, accessScopes } = useMemo(() => {
    initializeDefaultOrgStructures()
    return {
      departments: getAllDepartments(),
      accessScopes: getAllAccessScopes(),
    }
  }, [])

  const effectiveRoleName = useMemo(() => {
    return dbRbac.roleName || user?.role || null
  }, [dbRbac.roleName, user])

  // Get user permissions (DB-backed when available)
  const userPermissions = useMemo(() => {
    if (dbRbac.loaded) return dbRbac.permissions
    return getUserPermissions(user, roles)
  }, [dbRbac.loaded, dbRbac.permissions, user, roles])

  // Get questions for current user
  const userQuestions = useMemo(() => {
    initializeDefaultQuestionSets()
    return getQuestionsForUser(user)
  }, [user])

  // Permission checking functions (renamed to avoid conflicts)
  const checkPermission = useCallback(
    (permission: string) => {
      if (!user || !user.isActive) return false
      if (dbRbac.loaded) return dbRbac.permissions.includes(permission)
      return hasPermission(user, permission, roles)
    },
    [user, roles, dbRbac.loaded, dbRbac.permissions]
  )

  const checkAction = useCallback(
    (check: PermissionCheck, ownerId?: string) => {
      if (!user || !user.isActive) return false

      if (dbRbac.loaded) {
        const permission = `${check.resource}.${check.action}`

        if (dbRbac.permissions.includes(permission)) {
          return true
        }

        if (check.ownResource && ownerId === user.id) {
          const ownPermission = `${permission}.own`
          if (dbRbac.permissions.includes(ownPermission)) {
            return true
          }
        }

        return false
      }

      return canPerformAction(user, check, roles, ownerId)
    },
    [user, roles, dbRbac.loaded, dbRbac.permissions]
  )

  const checkRoleLevel = useCallback(
    (requiredLevel: number) => {
      if (!user || !user.isActive) return false

      const nameCandidate = effectiveRoleName
      const effectiveLevel =
        nameCandidate && nameCandidate in ROLE_HIERARCHY
          ? ROLE_HIERARCHY[nameCandidate]
          : ROLE_HIERARCHY[user.role] || 0

      return effectiveLevel >= requiredLevel
    },
    [user, effectiveRoleName]
  )

  const checkCanManageUser = useCallback(
    (targetUser: User) => {
      return canManageUser(user, targetUser, ROLE_HIERARCHY)
    },
    [user]
  )

  // Question management functions (renamed to avoid conflicts)
  const getRoleQuestions = useCallback((roleName: string) => {
    return getQuestionSetForRole(roleName)
  }, [])

  const getAllRoleQuestionSets = useCallback(() => {
    return getAllQuestionSets()
  }, [])

  const storeQuestionSet = useCallback((questionSet: RoleQuestionSet) => {
    saveQuestionSet(questionSet)
  }, [])

  const validateQuestion = useCallback((question: CustomQuestion, value: unknown) => {
    return validateQuestionResponse(question, value)
  }, [])

  const processQuestionResponsesData = useCallback(
    (questions: CustomQuestion[], responses: Record<string, unknown>) => {
      return processQuestionResponses(questions, responses)
    },
    []
  )

  const createQuestionResponseData = useCallback((question: CustomQuestion, value: unknown) => {
    return createQuestionResponse(question, value)
  }, [])

  // Convenience permission checks
  const canCreateEntries = checkPermission("entries.create")
  const canReadEntries = checkPermission("entries.read")
  const canUpdateEntries = checkPermission("entries.update")
  const canDeleteEntries = checkPermission("entries.delete")
  const canViewAnalytics = checkPermission("analytics.read")
  const canExportData = checkPermission("entries.export")
  const canImportData = checkPermission("entries.import")
  const canManageUsers = checkPermission("users.manage")
  const canAccessAdmin = checkPermission("admin.system")
  const isAdmin = checkRoleLevel(ROLE_HIERARCHY.admin)
  const isManager = checkRoleLevel(ROLE_HIERARCHY.manager)
  const isUser = checkRoleLevel(ROLE_HIERARCHY.user)
  const isViewer = checkRoleLevel(ROLE_HIERARCHY.viewer)

  const hasRole = useCallback(
    (roleName: string): boolean => {
      if (!user) return false
      return (effectiveRoleName || user.role) === roleName
    },
    [user, effectiveRoleName]
  )

  // ==================== PERMISSION CATEGORIES ====================

  const permissionCategories = useMemo(() => {
    const categories = {
      read: [] as string[],
      write: [] as string[],
      delete: [] as string[],
      admin: [] as string[],
    }

    userPermissions.forEach((permission) => {
      if (permission.includes(".read")) categories.read.push(permission)
      else if (permission.includes(".create") || permission.includes(".update") || permission.includes(".import"))
        categories.write.push(permission)
      else if (permission.includes(".delete")) categories.delete.push(permission)
      else if (permission.includes("admin.") || permission.includes(".manage")) categories.admin.push(permission)
    })

    return categories
  }, [userPermissions])

  // ==================== USER INFO ====================

  const userInfo = useMemo(() => {
    if (!user) return null

    const userRole = getRoleByName(effectiveRoleName ?? user.role, roles)

    return {
      ...user,
      role: userRole,
      permissions: userPermissions,
      permissionCategories,
      level:
        (effectiveRoleName && effectiveRoleName in ROLE_HIERARCHY
          ? ROLE_HIERARCHY[effectiveRoleName]
          : ROLE_HIERARCHY[user.role]) || 0,
    }
  }, [user, roles, userPermissions, permissionCategories, effectiveRoleName])

  const getAssignableRolesForUser = useCallback(() => {
    return getAssignableRoles(user, roles, ROLE_HIERARCHY)
  }, [user, roles])

  return {
    // User and permissions
    user,
    permissions: userPermissions,
    rbacLoaded: dbRbac.loaded,
    rbacLoading: dbRbac.loading,
    rbacChecked: dbRbac.checked,
    questions: userQuestions,
    roles,
    departments,
    accessScopes,

    // Permission checking
    hasPermission: checkPermission,
    canPerformAction: checkAction,
    hasRoleLevel: checkRoleLevel,
    hasRole: hasRole,
    canManageUser: checkCanManageUser,

    // Legacy/compat
    getAssignableRoles: getAssignableRolesForUser,
    userInfo,

    // Question management
    getQuestionsForRole: getRoleQuestions,
    getAllQuestionSets: getAllRoleQuestionSets,
    saveQuestionSet: storeQuestionSet,
    validateResponse: validateQuestion,
    processResponses: processQuestionResponsesData,
    createResponse: createQuestionResponseData,

    // Convenience checks
    canCreateEntries,
    canReadEntries,
    canUpdateEntries,
    canDeleteEntries,
    canViewAnalytics,
    canExportData,
    canImportData,
    canManageUsers,
    canAccessAdmin,
    isAdmin,
    isManager,
    isUser,
    isViewer,
  }
}

// ==================== SPECIALIZED HOOKS ====================

/**
 * Hook for entry-related permissions
 */
export function useEntryPermissions() {
  const { canPerformAction, user } = useRBAC()

  return {
    canCreate: canPerformAction({ resource: "entries", action: "create" }),
    canRead: canPerformAction({ resource: "entries", action: "read" }),
    canUpdate: (entryUserId?: string) =>
      canPerformAction({ resource: "entries", action: "update", ownResource: true }, entryUserId),
    canDelete: (entryUserId?: string) =>
      canPerformAction({ resource: "entries", action: "delete", ownResource: true }, entryUserId),
    canExport: canPerformAction({ resource: "entries", action: "export" }),
    canExportOwn: canPerformAction({ resource: "entries", action: "export", ownResource: true }, user?.id),
    canImport: canPerformAction({ resource: "entries", action: "import" }),
  }
}

/**
 * Hook for user management permissions
 */
export function useUserPermissions() {
  const { canPerformAction, canManageUser, hasPermission } = useRBAC()

  return {
    canCreate: canPerformAction({ resource: "users", action: "create" }),
    canRead: canPerformAction({ resource: "users", action: "read" }),
    canUpdate: (targetUser: User | null) =>
      targetUser ? canManageUser(targetUser) || canPerformAction({ resource: "users", action: "update" }) : false,
    canDelete: (targetUser: User | null) =>
      targetUser ? canManageUser(targetUser) || canPerformAction({ resource: "users", action: "delete" }) : false,
    canManage: hasPermission("users.manage"),
    canManageRoles: hasPermission("users.manage"),
  }
}

/**
 * Hook for analytics permissions
 */
export function useAnalyticsPermissions() {
  const { canPerformAction, user } = useRBAC()

  return {
    canRead: canPerformAction({ resource: "analytics", action: "read" }),
    canReadOwn: canPerformAction({ resource: "analytics", action: "read", ownResource: true }, user?.id),
    canViewAdvanced: canPerformAction({ resource: "analytics", action: "advanced" }),
    canViewTeam: canPerformAction({ resource: "analytics", action: "team" }),
  }
}

/**
 * Hook for admin permissions
 */
export function useAdminPermissions() {
  const { hasPermission } = useRBAC()

  return {
    canAccessSystem: hasPermission("admin.system"),
    canViewAudit: hasPermission("admin.audit"),
    canCreateBackup: hasPermission("admin.backup"),
    canRestoreBackup: hasPermission("admin.restore"),
    canManageSettings: hasPermission("admin.settings"),
    isSystemAdmin: hasPermission("admin.system"),
  }
}

// ==================== HIGHER-ORDER COMPONENTS ====================

/**
 * HOC to protect components that require specific permission
 */
export function withPermission<P extends object>(permission: string, Component: React.ComponentType<P>) {
  return function PermissionProtectedComponent(props: P) {
    const { hasPermission } = useRBAC()

    if (!hasPermission(permission)) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <h3 className="text-muted-foreground text-lg font-semibold">Access Denied</h3>
            <p className="text-muted-foreground mt-2 text-sm">You don't have permission to access this feature.</p>
          </div>
        </div>
      )
    }

    return <Component {...props} />
  }
}

/**
 * HOC to protect components that require specific role
 */
export function withRole<P extends object>(requiredRole: string, Component: React.ComponentType<P>) {
  return function RoleProtectedComponent(props: P) {
    const { hasRole, hasRoleLevel } = useRBAC()
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0

    if (!hasRole(requiredRole) && !hasRoleLevel(requiredLevel)) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <h3 className="text-muted-foreground text-lg font-semibold">Access Denied</h3>
            <p className="text-muted-foreground mt-2 text-sm">This feature requires {requiredRole} role or higher.</p>
          </div>
        </div>
      )
    }

    return <Component {...props} />
  }
}

/**
 * HOC to protect admin components
 */
export function withAdmin<P extends object>(Component: React.ComponentType<P>) {
  return withRole("admin", Component)
}

/**
 * HOC to protect manager components
 */
export function withManager<P extends object>(Component: React.ComponentType<P>) {
  return withRole("manager", Component)
}
