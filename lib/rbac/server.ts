import { createClient } from "../supabase/server"
import { adminSupabase } from "../supabase/admin"

function parsePermissionName(name: string) {
  const trimmed = name.trim()
  const idx = trimmed.indexOf(".")
  if (idx <= 0 || idx === trimmed.length - 1) return null

  const resource = trimmed.slice(0, idx).trim().toLowerCase()
  const action = trimmed
    .slice(idx + 1)
    .trim()
    .toLowerCase()

  if (!resource || !action) return null
  if (/\s/.test(resource) || /\s/.test(action)) return null

  return { resource, action }
}

async function getRolePermissionNames(userId: string) {
  const { data: profile, error: profileError } = await adminSupabase
    .from("user_profiles")
    .select("role_id")
    .eq("user_id", userId)
    .single()

  if (profileError || !profile) {
    return { roleId: null, permissions: [] as string[] }
  }

  const roleId = String(profile.role_id)
  const { data: rows, error: permError } = await adminSupabase
    .from("role_permissions")
    .select("resource, action")
    .eq("role_id", roleId)

  if (permError) {
    throw new Error("Failed to verify permissions")
  }

  const permissions = (rows || [])
    .map((row) => `${String(row.resource).trim().toLowerCase()}.${String(row.action).trim().toLowerCase()}`)
    .filter(Boolean)

  return { roleId, permissions }
}

export async function getDepartmentPermissionNames(userId: string, departmentId: string) {
  // Query unified membership table for access_level memberships
  const { data: assignment, error: assignmentError } = await adminSupabase
    .from("user_department_memberships")
    .select(
      `
      role_id,
      role:roles!inner(id, name, display_name, level)
    `
    )
    .eq("user_id", userId)
    .eq("department_id", departmentId)
    .eq("membership_type", "access_level")
    .eq("is_active", true)
    .maybeSingle()

  if (assignmentError) {
    throw new Error("Failed to load department access level")
  }

  if (!assignment?.role_id) {
    return {
      accessLevelId: null,
      accessLevel: null,
      permissions: [] as string[],
    }
  }

  // Get permissions from role_permissions table
  const { data: rows, error: permError } = await adminSupabase
    .from("role_permissions")
    .select("resource, action")
    .eq("role_id", assignment.role_id)

  if (permError) {
    throw new Error("Failed to load department permissions")
  }

  const permissions = (rows || [])
    .map((row) => `${String(row.resource).trim().toLowerCase()}.${String(row.action).trim().toLowerCase()}`)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))

  return {
    accessLevelId: assignment.role_id,
    accessLevel: assignment.role,
    permissions,
  }
}

export async function getEffectivePermissionsForUser(userId: string) {
  const [{ roleId, permissions }, { data: assignments, error: assignmentsError }] = await Promise.all([
    getRolePermissionNames(userId),
    adminSupabase
      .from("user_department_memberships")
      .select(
        `
        department_id,
        role_id,
        department:departments(id, name),
        role:roles!inner(id, name, display_name, level)
      `
      )
      .eq("user_id", userId)
      .eq("membership_type", "access_level")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ])

  if (assignmentsError) {
    throw new Error("Failed to load department access assignments")
  }

  const departmentAccess = await Promise.all(
    (assignments || []).map(async (assignment) => {
      const departmentPermissions = await getDepartmentPermissionNames(userId, assignment.department_id)
      return {
        departmentId: assignment.department_id,
        department: assignment.department,
        accessLevelId: assignment.role_id,
        accessLevel: departmentPermissions.accessLevel || assignment.role,
        permissions: departmentPermissions.permissions,
      }
    })
  )

  return {
    roleId,
    globalPermissions: permissions.sort((a, b) => a.localeCompare(b)),
    departmentAccess,
  }
}

export async function verifyPermissionForDepartmentFromRequest(
  request: Request,
  permission: string,
  departmentId: string
) {
  const supabase = await createClient()

  const authHeader = request.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null

  const {
    data: { user },
    error: userError,
  } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser()

  if (userError || !user) {
    return { ok: false as const, status: 401 as const, error: "Not authenticated" }
  }

  const parsed = parsePermissionName(permission)
  if (!parsed) {
    return { ok: false as const, status: 400 as const, error: "Invalid permission format" }
  }

  const { permissions: globalPermissions, roleId } = await getRolePermissionNames(user.id)
  const canonicalPermission = `${parsed.resource}.${parsed.action}`

  if (globalPermissions.includes(canonicalPermission)) {
    return {
      ok: true as const,
      userId: user.id,
      roleId,
      departmentId,
      source: "global" as const,
    }
  }

  const { accessLevelId, accessLevel, permissions } = await getDepartmentPermissionNames(user.id, departmentId)
  if (permissions.includes(canonicalPermission)) {
    return {
      ok: true as const,
      userId: user.id,
      roleId,
      departmentId,
      accessLevelId,
      accessLevel,
      source: "department" as const,
    }
  }

  return { ok: false as const, status: 403 as const, error: "Access denied" }
}

export async function verifyPermission(permission: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { ok: false as const, status: 401 as const, error: "Not authenticated" }
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role_id")
    .eq("user_id", user.id)
    .single()

  if (profileError || !profile) {
    return { ok: false as const, status: 403 as const, error: "Access denied" }
  }

  const roleId = String(profile.role_id)

  const parsed = parsePermissionName(permission)
  if (!parsed) {
    return { ok: false as const, status: 400 as const, error: "Invalid permission format" }
  }

  const { data: rows, error: permError } = await supabase
    .from("role_permissions")
    .select("id")
    .eq("role_id", roleId)
    .eq("resource", parsed.resource)
    .eq("action", parsed.action)
    .limit(1)

  if (permError) {
    return { ok: false as const, status: 500 as const, error: "Failed to verify permissions" }
  }

  if (!rows || rows.length === 0) {
    return { ok: false as const, status: 403 as const, error: "Access denied" }
  }

  return { ok: true as const, userId: user.id, roleId }
}

export async function verifyAnyPermission(permissions: string[]) {
  for (const perm of permissions) {
    const res = await verifyPermission(perm)
    if (res.ok) return res
  }

  return { ok: false as const, status: 403 as const, error: "Access denied" }
}

export async function verifyPermissionFromRequest(request: Request, permission: string) {
  const supabase = await createClient()

  const authHeader = request.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null

  const {
    data: { user },
    error: userError,
  } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser()

  if (userError || !user) {
    return { ok: false as const, status: 401 as const, error: "Not authenticated" }
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role_id")
    .eq("user_id", user.id)
    .single()

  if (profileError || !profile) {
    return { ok: false as const, status: 403 as const, error: "Access denied" }
  }

  const roleId = String(profile.role_id)

  const parsed = parsePermissionName(permission)
  if (!parsed) {
    return { ok: false as const, status: 400 as const, error: "Invalid permission format" }
  }

  const { data: rows, error: permError } = await supabase
    .from("role_permissions")
    .select("id")
    .eq("role_id", roleId)
    .eq("resource", parsed.resource)
    .eq("action", parsed.action)
    .limit(1)

  if (permError) {
    return { ok: false as const, status: 500 as const, error: "Failed to verify permissions" }
  }

  if (!rows || rows.length === 0) {
    return { ok: false as const, status: 403 as const, error: "Access denied" }
  }

  return { ok: true as const, userId: user.id, roleId }
}
