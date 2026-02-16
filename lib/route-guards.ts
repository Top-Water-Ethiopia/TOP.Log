import { requireAuth, getUserProfile, checkAdminPermissions, checkDepartmentMembership } from "./auth-guards"
import { getCacheValue, setCacheValue, clearCache } from "./cache"

/**
 * Determines where user should be redirected based on their role and permissions
 * Returns null if user should stay on current page
 */
export async function getUserRouteRedirect(): Promise<string | null> {
  const user = await requireAuth()

  // Check cache first for performance (undefined = no cache, null = stay on page)
  const cacheKey = `user:${user.id}:route-redirect`
  const cached = await getCacheValue<string | null>(cacheKey)
  if (cached !== undefined) return cached

  // Run queries in parallel where possible for better performance
  const [profile, hasDepartment] = await Promise.all([getUserProfile(user.id), checkDepartmentMembership(user.id)])

  const roleId = profile?.role_id ? String(profile.role_id) : null

  // Check if user has admin permissions
  const hasAdminAccess = await checkAdminPermissions(roleId)

  let redirectPath: string | null = null
  if (hasAdminAccess && !hasDepartment) {
    // If admin has no department membership, redirect to admin page
    redirectPath = "/admin"
  }

  // Cache the result for 5 minutes (null is a valid cached value)
  await setCacheValue(cacheKey, redirectPath, 300000)

  return redirectPath
}

/**
 * Invalidate user cache when permissions change
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  await clearCache(`user:${userId}:`)
}

/**
 * Checks if user can access admin routes
 */
export async function canAccessAdmin(): Promise<boolean> {
  try {
    const user = await requireAuth()
    const profile = await getUserProfile(user.id)
    const roleId = profile?.role_id ? String(profile.role_id) : null

    return await checkAdminPermissions(roleId)
  } catch {
    return false
  }
}
