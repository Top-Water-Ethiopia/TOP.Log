import type { SupabaseClient } from "@supabase/supabase-js"
import { pickJoinedRow } from "@/lib/utils"

export type UserDepartmentProfessionAssignment = {
  professionId: string | null
  professionKey: string | null
  professionName?: string | null
}

export type UserDepartmentAccessLevelAssignment = {
  accessLevelId: string | null
  accessLevelName: string | null
  accessLevelDisplayName: string | null
}

export type EffectiveDepartmentRole = {
  roleType: "profession" | "access-level" | null
  roleKey: string | null
  roleName: string | null
  professionId: string | null
  professionKey: string | null
  professionName: string | null
  accessLevelId: string | null
  accessLevelName: string | null
  accessLevelDisplayName: string | null
  canAnswerDepartmentReports: boolean
}


/**
 * Fetches ALL permissions for a given access level ID
 * Returns array of permission strings in format "resource.action"
 */
export async function getAccessLevelPermissions(supabase: SupabaseClient, accessLevelId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("role_permissions")
    .select("resource, action")
    .eq("role_id", accessLevelId)
    .eq("effect", "allow")

  if (error || !data) {
    return []
  }

  return data.map((p) => `${p.resource}.${p.action}`)
}

/**
 * Maps permission strings to capability flags
 */
function mapPermissionsToCapabilities(permissions: string[]): {
  canViewReports: boolean
  canCreateReports: boolean
  canAnswerDepartmentReports: boolean
  canManageMembers: boolean
  canExportReports: boolean
} {
  const hasDeptAnswer = permissions.includes("department_questions.answer")

  return {
    canViewReports:
      hasDeptAnswer ||
      permissions.some(
        (p) => p === "entries.read" || p === "entries.read.own" || p === "analytics.read" || p === "analytics.read.own"
      ),
    canCreateReports:
      hasDeptAnswer || permissions.some((p) => p === "entries.create" || p === "entries.create.own"),
    canAnswerDepartmentReports: hasDeptAnswer,
    canManageMembers: permissions.some((p) => p === "departments.members.manage" || p === "departments.members.read"),
    canExportReports: permissions.some((p) => p === "entries.export" || p === "entries.export.own"),
  }
}

export async function getUserDepartmentProfessionAssignment(
  supabase: SupabaseClient,
  userId: string,
  departmentId: string
): Promise<UserDepartmentProfessionAssignment | null> {
  const { data, error } = await supabase
    .from("user_department_memberships")
    .select("role_id, role:roles(id, name, display_name)")
    .eq("user_id", userId)
    .eq("department_id", departmentId)
    .eq("membership_type", "profession")
    .eq("is_active", true)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data || !data.role) return null

  const role = pickJoinedRow(data.role)

  return {
    professionId: data.role_id,
    professionKey: role?.name ?? null,
    professionName: role?.display_name ?? null,
  }
}

export async function getUserDepartmentAccessLevelAssignment(
  supabase: SupabaseClient,
  userId: string,
  departmentId: string
): Promise<UserDepartmentAccessLevelAssignment | null> {
  const { data, error } = await supabase
    .from("user_department_memberships")
    .select("role_id, role:roles(id, name, display_name)")
    .eq("user_id", userId)
    .eq("department_id", departmentId)
    .eq("membership_type", "access_level")
    .eq("is_active", true)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data || !data.role) return null

  const role = pickJoinedRow(data.role)

  return {
    accessLevelId: data.role_id,
    accessLevelName: role?.name ?? null,
    accessLevelDisplayName: role?.display_name ?? null,
  }
}

async function getDepartmentAnswerPermissionDefinitionId(supabase: SupabaseClient): Promise<string | null> {
  const { data: permissionDefinition, error } = await supabase
    .from("permission_definitions")
    .select("id")
    .eq("resource", "department_questions")
    .eq("action", "answer")
    .single()

  if (error || !permissionDefinition?.id) {
    return null
  }

  return permissionDefinition.id
}

async function accessLevelCanAnswerDepartmentQuestions(
  supabase: SupabaseClient,
  accessLevelId: string | null
): Promise<boolean> {
  if (!accessLevelId) return false

  const { data: permissionRow, error: permissionError } = await supabase
    .from("role_permissions")
    .select("effect")
    .eq("role_id", accessLevelId)
    .eq("resource", "department_questions")
    .eq("action", "answer")
    .eq("effect", "allow")
    .limit(1)
    .maybeSingle()

  if (permissionError) throw permissionError

  return !!permissionRow
}

export async function userCanAnswerDepartmentQuestions(
  supabase: SupabaseClient,
  userId: string,
  departmentId: string
): Promise<boolean> {
  const accessLevelAssignment = await getUserDepartmentAccessLevelAssignment(supabase, userId, departmentId)
  return accessLevelCanAnswerDepartmentQuestions(supabase, accessLevelAssignment?.accessLevelId ?? null)
}

export type EffectiveDepartmentMembership = {
  departmentId: string
  department: {
    id: string
    name: string
    description: string | null
    is_active: boolean
  }
  roleType: "profession" | "access-level" | null
  roleKey: string | null
  roleLabel: string | null
  // Membership status
  is_primary: boolean
  membershipStatus: "active" | "inactive"
  // Core capabilities (dynamically resolved from all access level permissions)
  canViewReports: boolean
  canCreateReports: boolean
  canAnswerDepartmentReports: boolean
  // Extended capabilities
  canManageMembers: boolean
  canExportReports: boolean
  // Raw permissions from all access levels (for advanced use cases)
  permissions: string[]
}

export async function getUserEffectiveDepartmentMemberships(
  supabase: SupabaseClient,
  userId: string,
  includeInactive: boolean = false
): Promise<EffectiveDepartmentMembership[]> {
  // Query all memberships for the user
  let query = supabase
    .from("user_department_memberships")
    .select(
      `
      department_id,
      membership_type,
      role_id,
      is_active,
      is_primary,
      department:departments!inner(id, name, description, is_active),
      role:roles(id, name, display_name)
    `
    )
    .eq("user_id", userId)

  if (!includeInactive) {
    query = query.eq("is_active", true)
  }

  const { data: assignments, error } = await query

  if (error) {
    throw error
  }

  // Build a map of departments with their assignments
  const departmentMap = new Map<
    string,
    {
      department: { id: string; name: string; description: string | null; is_active: boolean }
      profession: {
        professionId: string | null
        professionKey: string | null
        professionName: string | null
        is_active: boolean
        is_primary: boolean
      } | null
      accessLevels: Array<{
        accessLevelId: string | null
        accessLevelName: string | null
        accessLevelDisplayName: string | null
        is_active: boolean
      }>
    }
  >()

  for (const assignment of assignments || []) {
    const dept = Array.isArray(assignment.department) ? assignment.department[0] : assignment.department
    if (!dept) continue

    const role = pickJoinedRow(assignment.role)
    const existing = departmentMap.get(dept.id) || {
      department: dept,
      profession: null,
      accessLevels: [] as Array<{
        accessLevelId: string | null
        accessLevelName: string | null
        accessLevelDisplayName: string | null
        is_active: boolean
      }>,
    }

    if (assignment.membership_type === "profession") {
      existing.profession = {
        professionId: assignment.role_id,
        professionKey: role?.name ?? null,
        professionName: role?.display_name ?? null,
        is_active: assignment.is_active,
        is_primary: assignment.is_primary,
      }
    } else if (assignment.membership_type === "access_level") {
      existing.accessLevels.push({
        accessLevelId: assignment.role_id,
        accessLevelName: role?.name ?? null,
        accessLevelDisplayName: role?.display_name ?? null,
        is_active: assignment.is_active,
      })
    }

    departmentMap.set(dept.id, existing)
  }

  // Process each department to determine effective membership
  const memberships: EffectiveDepartmentMembership[] = []

  for (const [departmentId, data] of departmentMap) {
    // Skip inactive departments
    if (!data.department.is_active) continue

    // Fetch ALL permissions from ALL access levels for this department
    const allPermissions = new Set<string>()
    for (const accessLevel of data.accessLevels) {
      if (accessLevel.accessLevelId) {
        const permissions = await getAccessLevelPermissions(supabase, accessLevel.accessLevelId)
        permissions.forEach((p) => allPermissions.add(p))
      }
    }

    // Map permissions to capabilities
    const capabilities = mapPermissionsToCapabilities(Array.from(allPermissions))

    // Membership visibility rule:
    // - Has profession assignment, OR
    // - Has ANY permissions from access levels (not just department_questions.answer)
    const hasProfession = data.profession !== null
    const hasAccessLevelPermissions = allPermissions.size > 0

    if (!hasProfession && !hasAccessLevelPermissions) {
      continue // Skip this department - user is not a member
    }

    // Determine display role (profession takes precedence for display)
    let roleType: "profession" | "access-level" | null = null
    let roleKey: string | null = null
    let roleLabel: string | null = null

    if (hasProfession) {
      roleType = "profession"
      roleKey = data.profession!.professionKey
      roleLabel = data.profession!.professionName ?? data.profession!.professionKey ?? null
    } else if (hasAccessLevelPermissions && data.accessLevels.length > 0) {
      // Use the first access level for display
      const accessLevel = data.accessLevels[0]
      roleType = "access-level"
      roleKey = accessLevel.accessLevelName
      roleLabel = accessLevel.accessLevelDisplayName ?? accessLevel.accessLevelName ?? "Department Member"
    }

    // Profession gives base capabilities, access levels ADD capabilities
    const professionCapabilities = hasProfession
      ? { canViewReports: true, canCreateReports: true, canAnswerDepartmentReports: false }
      : { canViewReports: false, canCreateReports: false, canAnswerDepartmentReports: false }

    // Determine membership status and primary from profession or access levels
    const membershipIsActive = data.profession?.is_active ?? data.accessLevels.some((al) => al.is_active)
    const membershipIsPrimary = data.profession?.is_primary ?? false

    memberships.push({
      departmentId,
      department: data.department,
      roleType,
      roleKey,
      roleLabel,
      is_primary: membershipIsPrimary,
      membershipStatus: membershipIsActive ? "active" : "inactive",
      // Union of profession and access level capabilities
      canViewReports: professionCapabilities.canViewReports || capabilities.canViewReports,
      canCreateReports: professionCapabilities.canCreateReports || capabilities.canCreateReports,
      canAnswerDepartmentReports:
        professionCapabilities.canAnswerDepartmentReports || capabilities.canAnswerDepartmentReports,
      canManageMembers: capabilities.canManageMembers,
      canExportReports: capabilities.canExportReports,
      permissions: Array.from(allPermissions),
    })
  }

  return memberships
}

export async function getEffectiveDepartmentRole(
  supabase: SupabaseClient,
  userId: string,
  departmentId: string
): Promise<EffectiveDepartmentRole> {
  const [professionAssignment, accessLevelAssignment] = await Promise.all([
    getUserDepartmentProfessionAssignment(supabase, userId, departmentId),
    getUserDepartmentAccessLevelAssignment(supabase, userId, departmentId),
  ])

  const canAnswerDepartmentReports = await accessLevelCanAnswerDepartmentQuestions(
    supabase,
    accessLevelAssignment?.accessLevelId ?? null
  )

  if (professionAssignment?.professionKey || professionAssignment?.professionName) {
    return {
      roleType: "profession",
      roleKey: professionAssignment.professionKey,
      roleName: professionAssignment.professionName ?? professionAssignment.professionKey ?? null,
      professionId: professionAssignment.professionId ?? null,
      professionKey: professionAssignment.professionKey ?? null,
      professionName: professionAssignment.professionName ?? null,
      accessLevelId: accessLevelAssignment?.accessLevelId ?? null,
      accessLevelName: accessLevelAssignment?.accessLevelName ?? null,
      accessLevelDisplayName: accessLevelAssignment?.accessLevelDisplayName ?? null,
      canAnswerDepartmentReports,
    }
  }

  const accessLevelRoleName = canAnswerDepartmentReports
    ? accessLevelAssignment?.accessLevelDisplayName || accessLevelAssignment?.accessLevelName || null
    : null

  return {
    roleType: accessLevelRoleName ? "access-level" : null,
    roleKey: accessLevelRoleName ? (accessLevelAssignment?.accessLevelName ?? null) : null,
    roleName: accessLevelRoleName,
    professionId: professionAssignment?.professionId ?? null,
    professionKey: professionAssignment?.professionKey ?? null,
    professionName: professionAssignment?.professionName ?? null,
    accessLevelId: accessLevelAssignment?.accessLevelId ?? null,
    accessLevelName: accessLevelAssignment?.accessLevelName ?? null,
    accessLevelDisplayName: accessLevelAssignment?.accessLevelDisplayName ?? null,
    canAnswerDepartmentReports,
  }
}
