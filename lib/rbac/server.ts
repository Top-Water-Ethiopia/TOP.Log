import { createClient } from "../supabase/server"

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
    .from("permissions")
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
    .from("permissions")
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
