import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermissionForDepartmentFromRequest } from "@/lib/rbac/server"
import { pickJoinedRow } from "@/lib/utils"

export const dynamic = "force-dynamic"

// ── Error codes ──────────────────────────────────────────────────────────────
const ERR = {
  AUTH_UNAUTHORIZED: "AUTH_UNAUTHORIZED",
  AUTH_FORBIDDEN: "AUTH_FORBIDDEN",
  DEPARTMENT_NOT_FOUND: "DEPARTMENT_NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  TIMEOUT: "TIMEOUT",
} as const

function errorResponse(code: string, message: string, status: number, requestId: string) {
  return NextResponse.json({ code, message, requestId }, { status })
}

// ── Phone helpers ────────────────────────────────────────────────────────────
const E164_REGEX = /^\+[1-9]\d{7,14}$/

function isValidE164(phone: string | null): phone is string {
  return !!phone && E164_REGEX.test(phone)
}

function formatPhoneE164(phone: string, locale: string): string {
  if (locale === "ET" && /^\+2519\d{8}$/.test(phone)) {
    // +251911234567 → +251 911 234 567
    return `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7, 10)} ${phone.slice(10)}`
  }
  return phone
}

// ── Types ────────────────────────────────────────────────────────────────────
type MemberRow = {
  userId: string
  name: string | null
  phoneRaw: string | null
  phone: string | null
  phoneVisible: boolean
  role: { id: string; name: string; displayName: string | null } | null
  team: { membershipType: string; isPrimary: boolean }
  lastUpdated: string
  stats: { summary: null; window: null }
}

// ── Deduplicate memberships: one row per user ────────────────────────────────
// Prefer is_primary=true, then latest updated_at
function deduplicateMemberships(
  rows: Array<{
    user_id: string
    membership_type: string
    is_primary: boolean
    updated_at: string
    role_id: string
    role: unknown
  }>
): Array<(typeof rows)[0]> {
  const best = new Map<string, (typeof rows)[0]>()

  for (const row of rows) {
    const existing = best.get(row.user_id)
    if (!existing) {
      best.set(row.user_id, row)
      continue
    }
    // Prefer is_primary, then latest updated_at
    if (row.is_primary && !existing.is_primary) {
      best.set(row.user_id, row)
    } else if (row.is_primary === existing.is_primary && row.updated_at > existing.updated_at) {
      best.set(row.user_id, row)
    }
  }

  return Array.from(best.values())
}

// ── Handler ──────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const requestId = crypto.randomUUID()

  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return errorResponse(ERR.AUTH_UNAUTHORIZED, "Not authenticated", 401, requestId)
    }

    // ── Department lookup (normal client, RLS-safe) ────────────────────────
    const { data: department, error: deptError } = await supabase
      .from("departments")
      .select("id, name, slug")
      .eq("slug", "marketing")
      .maybeSingle()

    if (deptError || !department) {
      return errorResponse(ERR.DEPARTMENT_NOT_FOUND, "Marketing department not found", 404, requestId)
    }

    // ── Permission checks ──────────────────────────────────────────────────
    const readAuth = await verifyPermissionForDepartmentFromRequest(
      request,
      "marketing.team.read",
      department.id
    )

    if (!readAuth.ok) {
      return errorResponse(ERR.AUTH_FORBIDDEN, "Access denied", 403, requestId)
    }

    const contactAuth = await verifyPermissionForDepartmentFromRequest(
      request,
      "marketing.team.contact.read",
      department.id
    )

    const canViewPhone = contactAuth.ok

    // ── Fetch memberships ──────────────────────────────────────────────────
    // Use admin client for membership listing; RLS often restricts membership rows to the current user.
    const { data: memberships, error: membershipError } = await adminSupabase
      .from("user_department_memberships")
      .select(
        `
        user_id,
        membership_type,
        is_primary,
        updated_at,
        role_id,
        role:roles(id, name, display_name)
      `
      )
      .eq("department_id", department.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })

    if (membershipError) {
      console.error("[marketing-team] membership_query_failed", { requestId, error: membershipError.message })
      return errorResponse(ERR.INTERNAL_ERROR, "Failed to load team members", 500, requestId)
    }

    // Deduplicate: one row per user
    const uniqueMemberships = deduplicateMemberships((memberships || []) as Array<{
      user_id: string
      membership_type: string
      is_primary: boolean
      updated_at: string
      role_id: string
      role: unknown
    }>)

    const userIds = uniqueMemberships.map((m) => m.user_id)

    // ── Fetch profiles (separate query for RLS safety) ─────────────────────
    let profileMap = new Map<string, { name: string | null; phone_e164: string | null }>()

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await adminSupabase
        .from("user_profiles")
        .select("user_id, name, phone_e164")
        .in("user_id", userIds)

      if (profilesError) {
        console.error("[marketing-team] profiles_query_failed", { requestId, error: profilesError.message })
        // Continue with empty profiles rather than failing completely
      } else {
        profileMap = new Map(
          (profiles || []).map((p) => [p.user_id, { name: p.name, phone_e164: p.phone_e164 }])
        )
      }
    }

    // ── Detect RLS join issues ─────────────────────────────────────────────
    const allProfilesNull = userIds.length > 0 && userIds.every((id) => !profileMap.has(id))
    if (allProfilesNull) {
      console.warn("[marketing-team] rls_join_failure_all_null", { requestId, departmentId: department.id })
    }

    const someProfilesNull = userIds.length > 0 && userIds.some((id) => !profileMap.has(id)) && userIds.some((id) => profileMap.has(id))
    if (someProfilesNull) {
      console.warn("[marketing-team] rls_partial_join_failure", { requestId, departmentId: department.id })
    }

    // ── Build response ─────────────────────────────────────────────────────
    const members: MemberRow[] = uniqueMemberships
      .map((m) => {
        const profile = profileMap.get(m.user_id)
        const role = pickJoinedRow(m.role as { id: string; name: string; display_name: string | null } | { id: string; name: string; display_name: string | null }[] | null)
        const phoneRaw = profile?.phone_e164 ?? null
        const phone = canViewPhone && isValidE164(phoneRaw) ? formatPhoneE164(phoneRaw, "ET") : null

        return {
          userId: m.user_id,
          name: profile?.name ?? null,
          phoneRaw: canViewPhone ? phoneRaw : null,
          phone,
          phoneVisible: canViewPhone,
          role: role ? { id: role.id, name: role.name, displayName: role.display_name } : null,
          team: {
            membershipType: m.membership_type,
            isPrimary: m.is_primary,
          },
          lastUpdated: m.updated_at,
          stats: { summary: null, window: null },
        } satisfies MemberRow
      })
      .sort((a, b) => {
        const roleA = (a.role?.displayName ?? "").toLowerCase()
        const roleB = (b.role?.displayName ?? "").toLowerCase()
        const nameA = (a.name ?? "").toLowerCase()
        const nameB = (b.name ?? "").toLowerCase()

        if (roleA !== roleB) return roleA.localeCompare(roleB)
        if (nameA !== nameB) return nameA.localeCompare(nameB)
        return a.userId.localeCompare(b.userId)
      })

    const hasMore = members.length > 100
    const trimmed = hasMore ? members.slice(0, 100) : members

    // ── Structured log ──────────────────────────────────────────────────────
    console.info("[marketing-team] ALLOW", {
      requestId,
      userId: user.id,
      departmentId: department.id,
      memberCount: trimmed.length,
      hasMore,
      permission: { read: true, contact: canViewPhone },
    })

    return NextResponse.json({
      data: {
        department: { id: department.id, name: department.name, slug: department.slug },
        members: trimmed,
        meta: { hasMore },
      },
    })
  } catch (error) {
    console.error("[marketing-team] UNEXPECTED_ERROR", {
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    return errorResponse(ERR.INTERNAL_ERROR, "Unexpected server error", 500, requestId)
  }
}
