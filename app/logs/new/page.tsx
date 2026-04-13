import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getAllowedDates } from "@/lib/date-restrictions"
import { isDepartmentReportQuestion, matchesProfessionQuestion } from "@/lib/reporting-model"
import { getDefaultEntryKind as getConfiguredDefaultEntryKind } from "@/lib/entry-kinds"
import { normalizeSalesPromoterProfessionKey } from "@/lib/marketing-agents"
import {
  getEffectiveDepartmentRole,
} from "@/lib/server/department-reporting"
import { pickJoinedRow } from "@/lib/utils"
import { EntryFormMultistepClient } from "./client"

interface SearchParams {
  departmentId?: string
  date?: string
}

interface UserDepartment {
  id: string
  name: string
  role: string | null
}

type DepartmentQuestionRow = {
  id: string
  department_id: string | null
  department_profession_id?: string | null
  department_role?: string | null
  question_key?: string | null
  question_label: string
  question_type: string
  question_description: string | null
  placeholder: string | null
  options: unknown
  is_required: boolean
  display_order: number
  validation_rules: unknown
  is_active: boolean
  created_at: string
  updated_at: string
  metadata: unknown
  entry_kind?: string
}

function buildQueryString(params: SearchParams): string {
  const query = new URLSearchParams()
  if (params.departmentId) query.set("departmentId", params.departmentId)
  if (params.date) query.set("date", params.date)
  const qs = query.toString()
  return qs ? `?${qs}` : ""
}

function validateLogDate(dateStr: string | undefined): { valid: boolean; date: string } {
  if (!dateStr) {
    // Default to today in user's local timezone
    const today = new Date().toISOString().split("T")[0]
    return { valid: true, date: today }
  }

  // Check YYYY-MM-DD format
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(dateStr)) {
    return { valid: false, date: "" }
  }

  // Check if parseable
  const date = new Date(dateStr + "T00:00:00")
  if (isNaN(date.getTime())) {
    return { valid: false, date: "" }
  }

  // Check if future (using user's local date comparison)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const inputDate = new Date(dateStr + "T00:00:00")

  if (inputDate > today) {
    return { valid: false, date: "" }
  }

  return { valid: true, date: dateStr }
}

/**
 * Fetch the user's single department assignment.
 * Each user belongs to exactly one department.
 */
async function fetchUserDepartment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<UserDepartment | null> {
  const { data: membership, error: membershipError } = await supabase
    .from("user_department_memberships")
    .select(
      `
      department_id,
      department:departments (
        id,
        name
      ),
      role:roles (
        name
      )
    `
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (membershipError) {
    console.error("Error fetching user department membership:", membershipError)
  }

  if (membership) {
    const role = pickJoinedRow(membership.role)
    const department = pickJoinedRow(membership.department)
    return {
      id: membership.department_id,
      name: department?.name ?? "Unknown",
      role: role?.name || null,
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("department_id")
    .eq("user_id", userId)
    .maybeSingle()

  if (profileError || !profile?.department_id) {
    if (profileError) console.error("Error fetching user profile department:", profileError)
    return null
  }

  const { data: department, error: departmentError } = await supabase
    .from("departments")
    .select("id, name")
    .eq("id", profile.department_id)
    .maybeSingle()

  if (departmentError || !department) {
    if (departmentError) console.error("Error fetching department details:", departmentError)
    return null
  }

  return {
    id: department.id,
    name: department.name,
    role: null,
  }
}

async function fetchAuthorizedDepartment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  departmentId: string
): Promise<UserDepartment | null> {
  const { data: membership, error: membershipError } = await supabase
    .from("user_department_memberships")
    .select(
      `
      department_id,
      department:departments (
        id,
        name
      ),
      role:roles (
        name
      )
    `
    )
    .eq("user_id", userId)
    .eq("department_id", departmentId)
    .eq("is_active", true)
    .order("membership_type", { ascending: false }) // 'profession' > 'access_level' alphabetically
    .limit(1)
    .maybeSingle()

  if (membershipError) {
    console.error("Error checking requested department membership access:", membershipError)
  }

  if (membership) {
    const role = pickJoinedRow(membership.role)
    const department = pickJoinedRow(membership.department)
    return {
      id: membership.department_id,
      name: department?.name ?? "Unknown",
      role: role?.name || null,
    }
  }

  return null
}

/**
 * Fetch questions grouped by entry_kind for the reporting form.
 * Department report questions are shown only to users with department-level
 * reporting permission, while profession questions follow the user's assigned profession.
 */
async function fetchRoleQuestionsByKind(
  supabase: Awaited<ReturnType<typeof createClient>>,
  departmentId: string,
  userId: string
): Promise<Record<string, DepartmentQuestionRow[]>> {
  const getLegacyQuestionKeyFromMetadata = (metadata: unknown): string | null => {
    if (typeof metadata !== "object" || metadata === null) return null
    const value = (metadata as { legacy_question_key?: unknown }).legacy_question_key
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }

  const [{ data: questionRows, error: questionsError }, effectiveDepartmentRole] = await Promise.all([
      supabase
        .from("role_questions")
        .select("*")
        .eq("department_id", departmentId)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      getEffectiveDepartmentRole(supabase, userId, departmentId).catch((error) => {
        console.error("Error fetching effective department role for report questions:", error)
        return {
          roleType: null,
          roleKey: null,
          roleName: null,
          professionId: null,
          professionKey: null,
          professionName: null,
          accessLevelId: null,
          accessLevelName: null,
          accessLevelDisplayName: null,
          canAnswerDepartmentReports: false,
        }
      }),
    ])

  if (questionsError) {
    console.error("Error fetching report questions:", questionsError)
    return { standard: [], agent_call: [], daily_summary: [] }
  }

  const questions = ((questionRows as DepartmentQuestionRow[] | null) || []).filter((question) => {
    if (isDepartmentReportQuestion(question)) {
      return effectiveDepartmentRole.canAnswerDepartmentReports
    }

    return matchesProfessionQuestion(question, departmentId, effectiveDepartmentRole)
  })

  // Group by entry_kind
  const grouped = questions.reduce(
    (acc, question) => {
      const kind = question.entry_kind || "standard"
      if (!acc[kind]) acc[kind] = []
      acc[kind].push(question)
      return acc
    },
    {} as Record<string, DepartmentQuestionRow[]>
  )

  // Ensure all entry kinds exist (even if empty)
  const allKinds = ["standard", "agent_call", "daily_summary"]
  allKinds.forEach((k) => {
    if (!grouped[k]) grouped[k] = []
    // Sort within each group
    grouped[k].sort((a, b) => (a?.display_order ?? 0) - (b?.display_order ?? 0))
    // Add question keys
    grouped[k] = grouped[k].map((question) => {
      const directKey = typeof question.question_key === "string" ? question.question_key.trim() : ""
      const legacyKey = getLegacyQuestionKeyFromMetadata(question.metadata)
      return {
        ...question,
        question_key: directKey || legacyKey || question.id,
      }
    })
  })

  return grouped
}

/**
 * @deprecated Use fetchRoleQuestionsByKind for new code
 */
async function fetchRoleQuestions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  departmentId: string,
  userId: string
) {
  const grouped = await fetchRoleQuestionsByKind(supabase, departmentId, userId)
  // Flatten for backward compatibility
  return Object.values(grouped).flat()
}

function resolveClientRole(
  departmentRole: string | null,
  professionKey: string | null | undefined
): string | null {
  if (typeof professionKey === "string" && professionKey.trim().length > 0) {
    return normalizeSalesPromoterProfessionKey(professionKey)
  }

  if (typeof departmentRole === "string" && departmentRole.trim().length > 0) {
    return normalizeSalesPromoterProfessionKey(departmentRole)
  }

  return null
}

async function fetchExistingEntryId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  departmentId: string,
  userId: string,
  date: string,
  entryKind: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("captain_log_entries")
    .select("id")
    .eq("submitted_by_user_id", userId)
    .eq("entry_kind", entryKind)
    .eq("subject_department_id", departmentId)
    .eq("date", date)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("Error checking existing standard entry availability:", error)
    return null
  }

  return typeof data?.id === "string" ? data.id : null
}

export default async function NewLogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // 1. Authenticate (use getUser() instead of getSession() for security)
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    const params = await searchParams
    const redirectUrl = `/login?redirect=/logs/new${buildQueryString(params)}`
    redirect(redirectUrl)
  }

  const userId = user.id

  // 2. Await searchParams before accessing properties
  const params = await searchParams
  const requestedDepartmentId =
    typeof params.departmentId === "string" && params.departmentId.trim() ? params.departmentId.trim() : undefined

  // 3. Validate the requested date format and future-date guard.
  const dateValidation = validateLogDate(params.date)
  if (params.date && !dateValidation.valid) {
    redirect(
      `/logs/new${buildQueryString({
        ...params,
        date: undefined,
      })}`
    )
  }

  // 4. Resolve the active department. Explicit departmentId is honored only when the
  // user has an active profession or access-level assignment in that department.
  const department = requestedDepartmentId
    ? (await fetchAuthorizedDepartment(supabase, userId, requestedDepartmentId)) ||
      (await fetchUserDepartment(supabase, userId))
    : await fetchUserDepartment(supabase, userId)

  if (!department) {
    redirect("/?error=no_department")
  }

  // 5. Use the requested past date when valid; otherwise fall back to today.
  const targetDate = dateValidation.date

  if (!targetDate) {
    redirect("/logs")
  }

  // Canonicalize URL to ensure date param is set
  const canonicalQuery = buildQueryString({
    ...params,
    departmentId: department.id,
    date: targetDate,
  })

  if (`/logs/new${buildQueryString(params)}` !== `/logs/new${canonicalQuery}`) {
    redirect(`/logs/new${canonicalQuery}`)
  }

  const effectiveDepartmentRole = await getEffectiveDepartmentRole(supabase, userId, department.id).catch((error) => {
    console.error("Error resolving effective department role for new log page:", error)
    return {
      roleType: null,
      roleKey: null,
      roleName: null,
      professionId: null,
      professionKey: null,
      professionName: null,
      accessLevelId: null,
      accessLevelName: null,
      accessLevelDisplayName: null,
      canAnswerDepartmentReports: false,
    }
  })
  const resolvedRole = resolveClientRole(
    department.role,
    effectiveDepartmentRole.roleType === "profession" ? effectiveDepartmentRole.professionKey : null
  )

  const { data: scopeEntryKinds } = await (supabase as any)
    .from("scope_entry_kinds")
    .select("entry_kind, label, is_default, allow_multiple_per_day, is_active, department_profession_id")
    .eq("department_id", department.id)
    .eq("is_active", true)
    .eq("department_profession_id", resolvedRole || null)

  // 6. Fetch role questions and initial entry availability for the active reporting subject.
  const [questionsByKind] = await Promise.all([
    fetchRoleQuestionsByKind(supabase, department.id, userId),
  ])

  const initialAvailableEntryKinds = ((scopeEntryKinds as Array<{
    entry_kind: string
    label?: string
    is_default?: boolean
    allow_multiple_per_day?: boolean
  }> | null) || []).filter((kind) => (questionsByKind[kind.entry_kind] || []).length > 0)

  const initialEntryKind =
    initialAvailableEntryKinds.length > 0
      ? getConfiguredDefaultEntryKind(
          initialAvailableEntryKinds.map((kind, index) => ({
            id: `${kind.entry_kind}-${index}`,
            department_id: department.id,
            department_profession_id: resolvedRole,
            entry_kind: kind.entry_kind,
            label: kind.label || kind.entry_kind,
            description: null,
            sort_order: index,
            is_default: kind.is_default === true,
            is_active: true,
            supports_assigned_agent: false,
            allow_multiple_per_day: kind.allow_multiple_per_day === true,
            color: null,
            icon: null,
            created_by: null,
            updated_by: null,
            created_at: "",
            updated_at: "",
          }))
        )
      : Object.keys(questionsByKind).find((kind) => (questionsByKind[kind] || []).length > 0) || "standard"

  const initialExistingEntryId = await fetchExistingEntryId(
    supabase,
    department.id,
    userId,
    targetDate,
    initialEntryKind
  )

  // Flatten for backward compatibility with existing client
  const roleQuestions = Object.values(questionsByKind).flat()

  return (
    <EntryFormMultistepClient
      departmentId={department.id}
      departmentName={department.name}
      date={targetDate}
      allowedDates={getAllowedDates()}
      initialExistingEntryId={initialExistingEntryId}
      initialRoleQuestions={roleQuestions}
      initialQuestionsByKind={questionsByKind}
      initialAvailableEntryKinds={initialAvailableEntryKinds}
      role={resolvedRole}
      effectiveRoleName={effectiveDepartmentRole.roleName}
    />
  )
}
