"use client"

import { useContext, useCallback, useMemo } from "react"
import { useAuth } from "@/contexts/auth-context"
import type { User, Role, Permission, PermissionCheck, CustomQuestion, RoleQuestionSet, QuestionResponse, Department, AccessScope } from "@/lib/rbac/types"
import { ROLE_HIERARCHY } from "@/lib/rbac/types"
import {
  hasPermission,
  canPerformAction,
  hasRoleLevel,
  canManageUser,
  getUserPermissions,
  filterByPermission,
  getRoleByName,
  getAssignableRoles,
  isSystemRole,
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

export function useRBAC() {
  const { user } = useAuth()
  
  // Load roles from storage (normalize missing access scopes)
  const roles: Role[] = useMemo(() => {
    const stored = loadFromStorage("ROLES", [] as Role[])
    return stored.map((role) => ({
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
  
  // Get user permissions
  const userPermissions = useMemo(() => {
    return getUserPermissions(user, roles)
  }, [user, roles])
  
  // Get questions for current user
  const userQuestions = useMemo(() => {
    initializeDefaultQuestionSets()
    return getQuestionsForUser(user)
  }, [user])
  
  // Permission checking functions (renamed to avoid conflicts)
  const checkPermission = useCallback((permission: string) => {
    return hasPermission(user, permission, roles)
  }, [user, roles])
  
  const checkAction = useCallback((check: PermissionCheck, ownerId?: string) => {
    return canPerformAction(user, check, roles, ownerId)
  }, [user, roles])
  
  const checkRoleLevel = useCallback((requiredLevel: number) => {
    return hasRoleLevel(user, requiredLevel, ROLE_HIERARCHY)
  }, [user])
  
  const checkCanManageUser = useCallback((targetUser: User) => {
    return canManageUser(user, targetUser, ROLE_HIERARCHY)
  }, [user])
  
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
  
  const validateQuestion = useCallback((question: CustomQuestion, value: any) => {
    return validateQuestionResponse(question, value)
  }, [])
  
  const processQuestionResponsesData = useCallback((questions: CustomQuestion[], responses: Record<string, any>) => {
    return processQuestionResponses(questions, responses)
  }, [])
  
  const createQuestionResponseData = useCallback((question: CustomQuestion, value: any) => {
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
  
  const getRole = useCallback((roleName: string): Role | undefined => {
    return getRoleByName(roleName, roles)
  }, [roles])

  const hasRole = useCallback((roleName: string): boolean => {
    return user?.role === roleName
  }, [user])

  /**
   * Check if a role is a system role
   */
  const isSystemRoleCheck = useCallback((roleName: string): boolean => {
    return isSystemRole(roleName, roles)
  }, [roles])

  // ==================== DATA FILTERING ====================

  /**
   * Filter entries based on user permissions
   */
  const filterEntries = useCallback(<T extends { id: string; userId?: string }>(
    entries: T[]
  ): T[] => {
    return filterByPermission(entries, user, "entries.read", roles)
  }, [user, roles])

  /**
   * Filter entries that user can edit
   */
  const filterEditableEntries = useCallback(<T extends { id: string; userId?: string }>(
    entries: T[]
  ): T[] => {
    return filterByPermission(entries, user, "entries.update", roles)
  }, [user, roles])

  /**
   * Filter entries that user can delete
   */
  const filterDeletableEntries = useCallback(<T extends { id: string; userId?: string }>(
    entries: T[]
  ): T[] => {
    return filterByPermission(entries, user, "entries.delete", roles)
  }, [user, roles])

  // ==================== PERMISSION CATEGORIES ====================

  const permissionCategories = useMemo(() => {
    const categories = {
      read: [] as string[],
      write: [] as string[],
      delete: [] as string[],
      admin: [] as string[],
    }

    userPermissions.forEach(permission => {
      if (permission.includes(".read")) categories.read.push(permission)
      else if (permission.includes(".create") || permission.includes(".update") || permission.includes(".import")) categories.write.push(permission)
      else if (permission.includes(".delete")) categories.delete.push(permission)
      else if (permission.includes("admin.") || permission.includes(".manage")) categories.admin.push(permission)
    })

    return categories
  }, [userPermissions])

  // ==================== USER INFO ====================

  const userInfo = useMemo(() => {
    if (!user) return null

    const userRole = getRoleByName(user.role, roles)
    
    return {
      ...user,
      role: userRole,
      permissions: userPermissions,
      permissionCategories,
      level: ROLE_HIERARCHY[user.role] || 0,
    }
  }, [user, roles, userPermissions, permissionCategories])

  return {
    // User and permissions
    user,
    permissions: userPermissions,
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
      targetUser ? (canManageUser(targetUser) || canPerformAction({ resource: "users", action: "update" })) : false,
    canDelete: (targetUser: User | null) => 
      targetUser ? (canManageUser(targetUser) || canPerformAction({ resource: "users", action: "delete" })) : false,
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
  const { hasPermission, isAdmin } = useRBAC()

  return {
    canAccessSystem: hasPermission("admin.system") || isAdmin,
    canViewAudit: hasPermission("admin.audit") || isAdmin,
    canCreateBackup: hasPermission("admin.backup") || isAdmin,
    canRestoreBackup: hasPermission("admin.restore") || isAdmin,
    canManageSettings: hasPermission("admin.settings") || isAdmin,
    isSystemAdmin: isAdmin,
  }
}

// ==================== HIGHER-ORDER COMPONENTS ====================

/**
 * HOC to protect components that require specific permission
 */
export function withPermission<P extends object>(
  permission: string,
  Component: React.ComponentType<P>
) {
  return function PermissionProtectedComponent(props: P) {
    const { hasPermission } = useRBAC()

    if (!hasPermission(permission)) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-muted-foreground">Access Denied</h3>
            <p className="text-sm text-muted-foreground mt-2">
              You don't have permission to access this feature.
            </p>
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
export function withRole<P extends object>(
  requiredRole: string,
  Component: React.ComponentType<P>
) {
  return function RoleProtectedComponent(props: P) {
    const { hasRole, hasRoleLevel } = useRBAC()
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0

    if (!hasRole(requiredRole) && !hasRoleLevel(requiredLevel)) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-muted-foreground">Access Denied</h3>
            <p className="text-sm text-muted-foreground mt-2">
              This feature requires {requiredRole} role or higher.
            </p>
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
