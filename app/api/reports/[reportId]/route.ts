import { createClient } from "@/lib/supabase/server"
import { canViewDepartmentLogs } from "@/lib/logs/visibility"
import { NextRequest, NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { evaluateConditionalLogic } from "@/lib/reporting-logic"
import { stableStringify } from "@/lib/report-edit/snapshot"
import { canEditReport, type CanEditReportResult } from "@/lib/report-edit/can-edit-report"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

interface CaptainLogEntry {
  id: string
  user_id: string
  submitted_by_user_id: string | null
  entry_date: string | null
  date: string
  edit_window_days_applied: number | null
  is_editable_applied: boolean
  questions_snapshot: unknown[] | null
  questions_snapshot_hash: string | null
  questions_snapshot_version: number | null
  updated_at: string
  subject_department_id: string | null
  department_id: string | null
}

interface SnapshotQuestion {
  id: string
  key: string
  label: string | null
  type: string | null
  category: string | null
  required: boolean | null
  conditional_logic: unknown
}

// UUID regex pattern to detect ID values
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ResponseValue {
  question_id: string
  question_key: string
  question_label: string | null
  question_type: string | null
  value: unknown
  display_order?: number | null
}

interface RawCustomResponse {
  question_id: string
  question_key: string
  question_label: string | null
  question_type: string | null
  value: unknown
}

interface RoleQuestionDisplayOrder {
  id: string
  display_order: number | null
}

function etagFromUpdatedAt(updatedAt: string | null | undefined): string | null {
  if (!updatedAt) return null
  const ms = new Date(updatedAt).getTime()
  if (!Number.isFinite(ms)) return null
  return Buffer.from(String(ms), "utf8").toString("base64")
}

function parseEtag(etag: string | null): number | null {
  // TODO: Use this during transition period if needed for backward compatibility
  // Currently not used - ETag comparison is done via direct string comparison
  if (!etag) return null
  try {
    // Try base64 format (new)
    return Number(Buffer.from(etag, "base64").toString("utf8"))
  } catch {
    // Fallback to ISO string format (old) - remove quotes if present
    const cleaned = etag.replace(/^"|"$/g, "")
    return new Date(cleaned).getTime()
  }
}

// Conditional logic types for hidden field conflict awareness
type ConditionalOperator = "equals" | "not_equals" | "contains" | "not_contains" | "greater_than" | "less_than"

type ConditionalLogic = {
  dependsOn: string
  operator: ConditionalOperator
  value: unknown
}

type SnapshotQuestionWithConditional = {
  id: string
  key?: string
  label: string
  type: string
  conditional_logic?: ConditionalLogic
  // ... other fields
}

function evaluateFieldVisibility(
  responses: Record<string, unknown>,
  questions: SnapshotQuestionWithConditional[]
): Record<string, boolean> {
  const visibility: Record<string, boolean> = {}

  for (const question of questions) {
    const key = question.key
    if (!key) {
      continue
    }

    // If no conditional logic, field is visible
    if (!question.conditional_logic) {
      visibility[key] = true
      continue
    }

    const { dependsOn, operator, value } = question.conditional_logic
    const dependentValue = responses[dependsOn]

    // Evaluate based on operator
    let isVisible = true

    switch (operator) {
      case "equals":
        isVisible = dependentValue === value
        break
      case "not_equals":
        isVisible = dependentValue !== value
        break
      case "contains":
        isVisible = Array.isArray(dependentValue)
          ? dependentValue.includes(value)
          : String(dependentValue).includes(String(value))
        break
      case "not_contains":
        isVisible = Array.isArray(dependentValue)
          ? !dependentValue.includes(value)
          : !String(dependentValue).includes(String(value))
        break
      case "greater_than":
        isVisible = typeof dependentValue === "number" && dependentValue > (value as number)
        break
      case "less_than":
        isVisible = typeof dependentValue === "number" && dependentValue < (value as number)
        break
      default:
        isVisible = true
    }

    visibility[key] = isVisible
  }

  return visibility
}

function isMeaningfullyEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === "string") return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  return false
}

function canonicalizeValue(value: unknown): unknown {
  if (typeof value === "string") return value.trim()
  if (Array.isArray(value)) {
    const normalized = value.map((v) => canonicalizeValue(v)).filter((v) => !isMeaningfullyEmpty(v))
    return normalized.slice().sort((a, b) => {
      const aStr = stableStringify(a) || ""
      const bStr = stableStringify(b) || ""
      return aStr.localeCompare(bStr)
    })
  }
  return value
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
      } else if (
        key.includes("role") ||
        key.includes("profession") ||
        key.includes("access_level") ||
        key.includes("accesslevel")
      ) {
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
    const { data: roles } = await resolver.from("roles").select("id, name, display_name").in("id", Array.from(roleIds))

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
  departmentNames: Map<string, string>,
  roleNames: Map<string, string>,
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
    if (
      (key.includes("role") ||
        key.includes("profession") ||
        key.includes("access_level") ||
        key.includes("accesslevel")) &&
      roleNames.has(value)
    ) {
      return { id: value, name: roleNames.get(value)! }
    }
    if (
      (key.includes("agent") || key.includes("assigned_agent") || key.includes("assignedagent")) &&
      marketingAgentNames.has(value)
    ) {
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
    return value.map((item) =>
      enrichValueWithNames(item, questionKey, userNames, departmentNames, roleNames, marketingAgentNames)
    )
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
      .select("*")
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

    // Get user's role from the new membership system
    const { data: memberships } = await supabase
      .from("user_department_memberships")
      .select("role_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)

    const isAdmin =
      memberships && memberships.length > 0
        ? memberships[0].role_id === ADMIN_ROLE_ID || memberships[0].role_id === SYSTEM_ADMIN_ROLE_ID
        : false
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

    // Fetch custom_responses
    const { data: rawCustomResponses } = await adminSupabase
      .from("custom_responses")
      .select("question_id, question_key, question_label, question_type, value")
      .eq("entry_id", reportId)

    // Fetch role_questions to get display_order for ordering
    const questionIds = (rawCustomResponses || [])
      .map((r: RawCustomResponse) => r.question_id)
      .filter((id: string | null): id is string => id !== null)
    let displayOrderMap = new Map<string, number>()

    if (questionIds.length > 0) {
      const { data: roleQuestions } = await adminSupabase
        .from("role_questions")
        .select("id, display_order")
        .in("id", questionIds)

      if (roleQuestions) {
        displayOrderMap = new Map(
          (roleQuestions as RoleQuestionDisplayOrder[]).map((rq) => [rq.id, rq.display_order ?? 0])
        )
      }
    }

    // Sort responses by display_order
    const customResponses = (rawCustomResponses || [])
      .map(
        (r: RawCustomResponse): ResponseValue => ({
          ...r,
          display_order: displayOrderMap.get(r.question_id) ?? 0,
        })
      )
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
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

    const etag = etagFromUpdatedAt((report as any)?.updated_at)
    const res = NextResponse.json({
      data: {
        ...report,
        profile: { name: authorProfile?.name ?? null },
        custom_responses: enrichedResponses,
      },
    })
    if (etag) {
      res.headers.set("ETag", etag)
    }
    return res
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

type PutBody = {
  snapshot_version: number
  snapshot_hash: string
  responses: Array<{
    question_id: string
    question_key: string
    question_label: string | null
    question_type: string | null
    value: unknown
  }>
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await params

    if (!reportId) {
      return NextResponse.json({ error: "Report ID is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as PutBody | null
    if (!body || !Array.isArray(body.responses)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    }

    const ifMatch = request.headers.get("if-match")
    const idempotencyKey = request.headers.get("idempotency-key")

    const { data: entry, error: entryError } = await supabase
      .from("captain_log_entries")
      .select("*")
      .eq("id", reportId)
      .single()

    if (entryError || !entry) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    const logEntry = entry as unknown as CaptainLogEntry
    const submittedByUserId =
      typeof logEntry.submitted_by_user_id === "string" && logEntry.submitted_by_user_id
        ? String(logEntry.submitted_by_user_id)
        : String(logEntry.user_id)

    // Get user's role from the new membership system
    const { data: memberships } = await supabase
      .from("user_department_memberships")
      .select("role_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)

    const isAdmin =
      memberships && memberships.length > 0
        ? memberships[0].role_id === ADMIN_ROLE_ID || memberships[0].role_id === SYSTEM_ADMIN_ROLE_ID
        : false

    if (!isAdmin && submittedByUserId !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const currentEtag = etagFromUpdatedAt(logEntry.updated_at)
    if (!currentEtag || !ifMatch || ifMatch !== currentEtag) {
      return NextResponse.json({ error: "Conflict", code: "CONFLICT", etag: currentEtag }, { status: 409 })
    }

    const questionsSnapshot = logEntry.questions_snapshot
    const snapshotHash = logEntry.questions_snapshot_hash
    const snapshotVersion = logEntry.questions_snapshot_version
    const isEditableApplied = logEntry.is_editable_applied === true

    // Check if this is a legacy report without snapshot
    const hasSnapshot = !!questionsSnapshot && !!snapshotHash && !!snapshotVersion

    // Snapshot hash/version validation (only for reports with snapshot)
    if (hasSnapshot) {
      if (!snapshotHash || !snapshotVersion) {
        return NextResponse.json({ error: "Snapshot not configured", code: "SNAPSHOT_NOT_CONFIGURED" }, { status: 400 })
      }

      if (body.snapshot_hash !== snapshotHash || body.snapshot_version !== snapshotVersion) {
        return NextResponse.json({ error: "Snapshot mismatch", code: "SNAPSHOT_MISMATCH" }, { status: 400 })
      }
    }

    // Full payload validation: require the same question IDs as the snapshot (only for reports with snapshot)
    if (hasSnapshot) {
      const snapshotIds = new Set(
        (questionsSnapshot || [])
          .map((q: unknown) => (typeof (q as { id?: unknown })?.id === "string" ? (q as { id: string }).id : null))
          .filter((id): id is string => !!id)
      )
      const payloadIds = new Set(
        body.responses.map((r) => r.question_id).filter((id): id is string => typeof id === "string")
      )

      // Validate count
      if (snapshotIds.size !== payloadIds.size) {
        return NextResponse.json({ error: "Payload incomplete", code: "PAYLOAD_INCOMPLETE" }, { status: 400 })
      }

      // Validate identity - ensure all snapshot IDs are in payload
      for (const id of snapshotIds) {
        if (!payloadIds.has(id)) {
          return NextResponse.json(
            { error: "Payload missing required question IDs", code: "PAYLOAD_MISSING_IDS" },
            { status: 400 }
          )
        }
      }

      // Validate identity - ensure no extra IDs in payload
      for (const id of payloadIds) {
        if (!snapshotIds.has(id)) {
          return NextResponse.json(
            { error: "Payload contains extra question IDs", code: "PAYLOAD_EXTRA_IDS" },
            { status: 400 }
          )
        }
      }
    }

    const entryDate =
      typeof logEntry.entry_date === "string" && logEntry.entry_date ? logEntry.entry_date : logEntry.date
    const windowDays = typeof logEntry.edit_window_days_applied === "number" ? logEntry.edit_window_days_applied : null

    const editCheck: CanEditReportResult = canEditReport(
      {
        entry_date: entryDate,
        edit_window_days_applied: windowDays,
        is_editable_applied: isEditableApplied,
        questions_snapshot: hasSnapshot ? questionsSnapshot : null,
        submitted_by_user_id: submittedByUserId,
      },
      user.id
    )

    // Enforce snapshot requirement strictly - no legacy bypass
    if (!editCheck.can_edit) {
      const errorMap: Record<Exclude<typeof editCheck.edit_reason, null>, { message: string; code: string }> = {
        NO_SNAPSHOT: { message: "Snapshot missing", code: "SNAPSHOT_MISSING" },
        DISABLED: { message: "Editing is disabled for this report", code: "EDIT_DISABLED" },
        NOT_AVAILABLE: { message: "Editing is not available for this report", code: "EDIT_NOT_AVAILABLE" },
        WINDOW_EXPIRED: { message: "Edit window expired", code: "EDIT_WINDOW_EXPIRED" },
        NOT_OWNER: { message: "Access denied", code: "NOT_OWNER" },
      }

      const error = editCheck.edit_reason
        ? errorMap[editCheck.edit_reason]
        : { message: "Cannot edit report", code: "CANNOT_EDIT" }
      return NextResponse.json(
        { error: error.message, code: error.code, edit_expires_at: editCheck.edit_expires_at },
        { status: editCheck.edit_reason === "NOT_OWNER" ? 403 : 400 }
      )
    }

    const { data: prevResponses } = await adminSupabase
      .from("custom_responses")
      .select("question_id, question_key, question_label, question_type, value")
      .eq("entry_id", reportId)

    const prevByKey: Record<string, unknown> = {}
    ;(prevResponses || []).forEach((r: any) => {
      if (typeof r?.question_key === "string") {
        prevByKey[r.question_key] = canonicalizeValue(r.value)
      }
    })

    const incomingByKey: Record<string, unknown> = {}
    body.responses.forEach((r) => {
      if (typeof r.question_key === "string") {
        incomingByKey[r.question_key] = canonicalizeValue(r.value)
      }
    })

    const mergedForVisibility = { ...prevByKey, ...incomingByKey }
    const finalByKey: Record<string, unknown> = { ...prevByKey }

    const snapshotById = new Map<string, SnapshotQuestion>()
    ;(questionsSnapshot || []).forEach((q: unknown) => {
      if (typeof (q as SnapshotQuestion)?.id === "string")
        snapshotById.set((q as SnapshotQuestion).id, q as SnapshotQuestion)
    })

    for (const response of body.responses) {
      const q = snapshotById.get(response.question_id)
      if (!q) continue
      const key = typeof q.key === "string" ? q.key : response.question_key
      if (!key) continue

      const visible = evaluateConditionalLogic(q.conditional_logic, mergedForVisibility)
      if (!visible) {
        // preserve stored value for hidden questions
        continue
      }

      const value = incomingByKey[key]
      if (q.required && isMeaningfullyEmpty(value)) {
        return NextResponse.json(
          { error: `${String(q.label || key)} is required`, code: "VALIDATION_ERROR", key },
          { status: 400 }
        )
      }

      finalByKey[key] = value
    }

    const prevStr = stableStringify(prevByKey) || "{}"
    const finalStr = stableStringify(finalByKey) || "{}"
    if (prevStr === finalStr) {
      const ok = NextResponse.json({ success: true, no_change: true, etag: currentEtag })
      ok.headers.set("ETag", currentEtag)
      return ok
    }

    // Phase 5: Hidden field conflict awareness
    // Evaluate visibility for both previous and incoming state
    // Preserve values for fields that were visible but become hidden due to conditional logic
    const snapshotForVisibility = (questionsSnapshot || []) as unknown as SnapshotQuestionWithConditional[]
    const previousVisibility = evaluateFieldVisibility(prevByKey, snapshotForVisibility)
    const currentVisibility = evaluateFieldVisibility(finalByKey, snapshotForVisibility)

    // Preserve values for fields that were visible but are now hidden
    for (const [key, value] of Object.entries(prevByKey)) {
      if (previousVisibility[key] && !currentVisibility[key]) {
        finalByKey[key] = value
      }
    }

    const responseRows: any[] = []
    for (const q of questionsSnapshot || []) {
      const question = q as SnapshotQuestion
      const key = typeof question?.key === "string" ? question.key : null
      if (!key) continue
      const value = finalByKey[key]
      if (isMeaningfullyEmpty(value)) continue
      responseRows.push({
        entry_id: reportId,
        question_id: typeof question.id === "string" ? question.id : `snap_${key}`,
        question_key: key,
        question_label: typeof question.label === "string" ? question.label : null,
        question_type: typeof question.type === "string" ? question.type : null,
        question_category: typeof question.category === "string" ? question.category : "custom",
        value,
        timestamp: new Date().toISOString(),
      })
    }

    const { error: delError } = await adminSupabase.from("custom_responses").delete().eq("entry_id", reportId)
    if (delError) {
      return NextResponse.json({ error: "Failed to update responses" }, { status: 500 })
    }
    if (responseRows.length > 0) {
      const { error: insError } = await adminSupabase.from("custom_responses").insert(responseRows)
      if (insError) {
        return NextResponse.json({ error: "Failed to update responses" }, { status: 500 })
      }
    }

    const auditPayload = {
      entry_id: reportId,
      edited_by: user.id,
      edit_type: isAdmin ? "admin" : "user",
      reason: null,
      previous_custom_responses: prevByKey,
      new_custom_responses: finalByKey,
      idempotency_key: idempotencyKey || null,
    }

    // Idempotency: use transaction-safe insert with idempotency key
    if (idempotencyKey) {
      const { data: result, error: insertError } = await (adminSupabase as any).rpc(
        "insert_entry_edit_with_idempotency",
        {
          p_entry_id: reportId,
          p_edited_by: user.id,
          p_edit_type: isAdmin ? "admin" : "user",
          p_previous_responses: prevByKey,
          p_new_responses: finalByKey,
          p_idempotency_key: idempotencyKey,
        }
      )

      if (insertError) {
        console.error("Idempotency insert error:", insertError)
        return NextResponse.json({ error: "Failed to save edit", code: "INSERT_ERROR" }, { status: 500 })
      }

      // If inserted is false, it means the key already existed (idempotent)
      const wasInserted = result?.[0]?.inserted === true

      if (!wasInserted) {
        // Fetch latest state to return correct ETag
        const { data: latestEntry } = await adminSupabase
          .from("captain_log_entries")
          .select("updated_at")
          .eq("id", reportId)
          .single()

        const latestEtag = latestEntry?.updated_at ? etagFromUpdatedAt(latestEntry.updated_at) : currentEtag

        if (latestEtag) {
          const ok = NextResponse.json({ success: true, idempotent: true, etag: latestEtag })
          ok.headers.set("ETag", latestEtag)
          return ok
        }

        // Fallback if no ETag available
        const ok = NextResponse.json({ success: true, idempotent: true, etag: currentEtag })
        if (currentEtag) {
          ok.headers.set("ETag", currentEtag)
        }
        return ok
      }
    } else {
      // No idempotency key, use regular insert
      const { error: auditError } = await (adminSupabase as any).from("entry_edits").insert(auditPayload)
      if (auditError) {
        return NextResponse.json({ error: "Failed to write audit" }, { status: 500 })
      }
    }

    const nowIso = new Date().toISOString()
    const { error: updateError } = await adminSupabase
      .from("captain_log_entries")
      .update({ edited_at: nowIso, edited_by: user.id, updated_at: nowIso })
      .eq("id", reportId)

    if (updateError) {
      return NextResponse.json({ error: "Failed to update report metadata" }, { status: 500 })
    }

    const newEtag = etagFromUpdatedAt(nowIso) || currentEtag
    const ok = NextResponse.json({ success: true, updated_at: nowIso, edited_at: nowIso, etag: newEtag })
    ok.headers.set("ETag", newEtag)
    return ok
  } catch (error) {
    console.error("Report PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
