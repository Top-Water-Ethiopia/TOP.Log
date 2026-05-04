import { createClient } from "@/lib/supabase/server"
import { canViewDepartmentLogs } from "@/lib/logs/visibility"
import { NextRequest, NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

// UUID regex pattern to detect ID values
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ResponseValue {
  question_id: string
  question_key: string
  question_label: string | null
  question_type: string | null
  value: unknown
}

/**
 * Extract UUIDs from a response value (handles single values and arrays)
 */
function extractIdsFromValue(value: unknown): string[] {
  if (typeof value === "string" && UUID_REGEX.test(value)) {
    return [value]
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const v = value as Record<string, unknown>
    const candidates = [v.id, v.user_id, v.department_id, v.role_id]
    return candidates.filter((id): id is string => typeof id === "string" && UUID_REGEX.test(id))
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractIdsFromValue(item))
  }
  return []
}

/**
 * Collect all unique IDs from custom responses
 */
function collectIdsFromResponses(responses: ResponseValue[]): {
  userIds: Set<string>
  departmentIds: Set<string>
  roleIds: Set<string>
  marketingAgentIds: Set<string>
} {
  const userIds = new Set<string>()
  const departmentIds = new Set<string>()
  const roleIds = new Set<string>()
  const marketingAgentIds = new Set<string>()

  for (const response of responses) {
    const ids = extractIdsFromValue(response.value)

    // Categorize based on question key patterns
    for (const id of ids) {
      const key = response.question_key?.toLowerCase() || ""
      if (key.includes("user") || key.includes("assignee") || key.includes("member") || key.includes("owner")) {
        userIds.add(id)
      } else if (key.includes("role") || key.includes("profession") || key.includes("access_level") || key.includes("accesslevel")) {
        roleIds.add(id)
      } else if (key.includes("agent") || key.includes("assigned_agent") || key.includes("assignedagent")) {
        marketingAgentIds.add(id)
      } else if (key.includes("department") || key.includes("dept")) {
        departmentIds.add(id)
      } else {
        // Add to all sets - we'll resolve what we can
        userIds.add(id)
        departmentIds.add(id)
        roleIds.add(id)
        marketingAgentIds.add(id)
      }
    }
  }

  return { userIds, departmentIds, roleIds, marketingAgentIds }
}

/**
 * Resolve IDs to display names
 */
async function resolveIdNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: Set<string>,
  departmentIds: Set<string>,
  roleIds: Set<string>,
  marketingAgentIds: Set<string>
): Promise<{
  userNames: Map<string, string>
  departmentNames: Map<string, string>
  roleNames: Map<string, string>
  marketingAgentNames: Map<string, string>
}> {
  const userNames = new Map<string, string>()
  const departmentNames = new Map<string, string>()
  const roleNames = new Map<string, string>()
  const marketingAgentNames = new Map<string, string>()

  // Use admin client for name resolution only (viewer authorization is enforced earlier in this route).
  // This avoids RLS blocking lookups for related entities referenced in the report.
  const resolver = adminSupabase

  // Resolve user names
  if (userIds.size > 0) {
    const { data: users } = await resolver
      .from("user_profiles")
      .select("user_id, name")
      .in("user_id", Array.from(userIds))

    users?.forEach((user) => {
      if (user.user_id && user.name) {
        userNames.set(user.user_id, user.name)
      }
    })
  }

  // Resolve department names
  if (departmentIds.size > 0) {
    const { data: departments } = await resolver
      .from("departments")
      .select("id, name")
      .in("id", Array.from(departmentIds))

    departments?.forEach((dept) => {
      if (dept.id && dept.name) {
        departmentNames.set(dept.id, dept.name)
      }
    })
  }

  // Resolve role/profession/access level display names
  if (roleIds.size > 0) {
    const { data: roles } = await resolver
      .from("roles")
      .select("id, name, display_name")
      .in("id", Array.from(roleIds))

    roles?.forEach((role) => {
      if (!role.id) return
      const label = role.display_name || role.name
      if (label) {
        roleNames.set(role.id, label)
      }
    })
  }

  // Resolve marketing agent names
  if (marketingAgentIds.size > 0) {
    const { data: agents } = await resolver
      .from("marketing_agents")
      .select("id, name")
      .in("id", Array.from(marketingAgentIds))

    agents?.forEach((agent) => {
      if (agent.id && agent.name) {
        marketingAgentNames.set(agent.id, agent.name)
      }
    })
  }

  return { userNames, departmentNames, roleNames, marketingAgentNames }
}

/**
 * Enrich a response value with display names
 */
function enrichValueWithNames(
  value: unknown,
  questionKey: string,
  userNames: Map<string, string>,
  departmentNames: Map<string, string>
  ,
  roleNames: Map<string, string>
  ,
  marketingAgentNames: Map<string, string>
): unknown {
  // Preserve already-enriched objects (or enrich by their id field if possible)
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const existingName = (value as { name?: unknown }).name
    if (typeof existingName === "string" && existingName.trim()) {
      return value
    }
    const id = (value as { id?: unknown }).id
    if (typeof id === "string" && UUID_REGEX.test(id)) {
      const enriched = enrichValueWithNames(id, questionKey, userNames, departmentNames, roleNames, marketingAgentNames)
      if (typeof enriched === "object" && enriched !== null) return enriched
    }
    return value
  }

  if (typeof value === "string" && UUID_REGEX.test(value)) {
    const key = questionKey.toLowerCase()
    if (
      (key.includes("user") || key.includes("assignee") || key.includes("member") || key.includes("owner")) &&
      userNames.has(value)
    ) {
      return { id: value, name: userNames.get(value)! }
    }
    if ((key.includes("role") || key.includes("profession") || key.includes("access_level") || key.includes("accesslevel")) && roleNames.has(value)) {
      return { id: value, name: roleNames.get(value)! }
    }
    if ((key.includes("agent") || key.includes("assigned_agent") || key.includes("assignedagent")) && marketingAgentNames.has(value)) {
      return { id: value, name: marketingAgentNames.get(value)! }
    }
    if ((key.includes("department") || key.includes("dept")) && departmentNames.has(value)) {
      return { id: value, name: departmentNames.get(value)! }
    }
    // Try both maps if no pattern match
    if (userNames.has(value)) {
      return { id: value, name: userNames.get(value)! }
    }
    if (departmentNames.has(value)) {
      return { id: value, name: departmentNames.get(value)! }
    }
    if (roleNames.has(value)) {
      return { id: value, name: roleNames.get(value)! }
    }
    if (marketingAgentNames.has(value)) {
      return { id: value, name: marketingAgentNames.get(value)! }
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => enrichValueWithNames(item, questionKey, userNames, departmentNames, roleNames, marketingAgentNames))
  }

  return value
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await params

    if (!reportId) {
      return NextResponse.json({ error: "Report ID is required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the report (avoid an inner join on user_profiles here, since missing profiles or RLS
    // on user_profiles can incorrectly make the report look "not found").
    const { data: report, error: reportError } = await supabase
      .from("captain_log_entries")
      .select(
        `
        *,
        custom_responses (
          question_id,
          question_key,
          question_label,
          question_type,
          value
        )
      `
      )
      .eq("id", reportId)
      .single()

    if (reportError) {
      // Supabase/postgrest uses different error codes depending on the client.
      // We treat "no rows" as 404 and permission/RLS-style errors as 403.
      const message = (reportError as { message?: string }).message || ""
      const code = (reportError as { code?: string }).code || ""

      if (code === "PGRST116" || /0 rows/i.test(message)) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 })
      }

      if (/permission denied|rls|not allowed/i.test(message)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }

      console.error("Report fetch error:", reportError)
      return NextResponse.json({ error: "Failed to load report" }, { status: 500 })
    }

    const { data: profile } = await supabase.from("user_profiles").select("role_id").eq("user_id", user.id).single()

    const isAdmin = profile?.role_id === ADMIN_ROLE_ID || profile?.role_id === SYSTEM_ADMIN_ROLE_ID
    const submittedByUserId =
      typeof report.submitted_by_user_id === "string" && report.submitted_by_user_id
        ? report.submitted_by_user_id
        : report.user_id
    const isOwnReport = submittedByUserId === user.id

    if (!isAdmin && !isOwnReport) {
      const reportDepartmentId =
        typeof report.subject_department_id === "string" && report.subject_department_id
          ? report.subject_department_id
          : typeof report.department_id === "string"
            ? report.department_id
            : null

      if (!reportDepartmentId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }

      const { data: departmentAccess } = await supabase
        .from("user_department_memberships")
        .select(
          `
          access_level:roles (
            name
          )
        `
        )
        .eq("user_id", user.id)
        .eq("department_id", reportDepartmentId)
        .eq("membership_type", "access_level")
        .maybeSingle()

      const accessLevelName = (departmentAccess?.access_level as { name?: string } | null)?.name || null
      const canViewDepartmentReport = canViewDepartmentLogs(accessLevelName)

      if (!canViewDepartmentReport) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
    }

    const { data: authorProfile } = await supabase
      .from("user_profiles")
      .select("name")
      .eq("user_id", submittedByUserId)
      .single()

    // Enrich custom_responses with display names for user/department IDs
    const customResponses = (report.custom_responses || []) as ResponseValue[]
    const { userIds, departmentIds, roleIds, marketingAgentIds } = collectIdsFromResponses(customResponses)
    const { userNames, departmentNames, roleNames, marketingAgentNames } = await resolveIdNames(
      supabase,
      userIds,
      departmentIds,
      roleIds,
      marketingAgentIds
    )

    const enrichedResponses = customResponses.map((response) => ({
      ...response,
      value: enrichValueWithNames(
        response.value,
        response.question_key || "",
        userNames,
        departmentNames,
        roleNames,
        marketingAgentNames
      ),
    }))

    return NextResponse.json({
      data: {
        ...report,
        profile: { name: authorProfile?.name ?? null },
        custom_responses: enrichedResponses,
      },
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
