import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getAllowedDates } from "@/lib/date-restrictions"
import { isDepartmentReportQuestion, matchesProfessionQuestion } from "@/lib/reporting-model"
import {
  getUserDepartmentProfessionAssignment,
  userCanAnswerDepartmentQuestions,
} from "@/lib/server/department-reporting"
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
    .from("user_department_professions")
    .select(
      `
      department_id,
      role,
      department:departments (
        id,
        name
      )
    `
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle()

  if (membershipError) {
    console.error("Error fetching user department profession:", membershipError)
  }

  if (membership) {
    return {
      id: membership.department_id,
      name: membership.department?.name ?? "Unknown",
      role: membership.role || null,
    }
  }

  const { data: accessAssignments, error: accessError } = await supabase
    .from("user_department_access_levels")
    .select(
      `
      department_id,
      department:departments (
        id,
        name
      )
    `
    )
    .eq("user_id", userId)
    .order("department_id", { ascending: true })
    .limit(1)

  if (accessError) {
    console.error("Error fetching user department access level:", accessError)
  }

  const accessAssignment = accessAssignments?.[0]
  if (accessAssignment) {
    return {
      id: accessAssignment.department_id,
      name: accessAssignment.department?.name ?? "Unknown",
      role: null,
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("department_id")
    .eq("user_id", userId)
    .maybeSingle()

  if (profileError) {
    console.error("Error fetching user profile department:", profileError)
    return null
  }

  if (!profile?.department_id) {
    return null
  }

  const { data: department, error: departmentError } = await supabase
    .from("departments")
    .select("id, name")
    .eq("id", profile.department_id)
    .maybeSingle()

  if (departmentError) {
    console.error("Error fetching department details:", departmentError)
    return null
  }

  if (!department) {
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
  const [{ data: membership, error: membershipError }, { data: accessAssignments, error: accessError }] =
    await Promise.all([
      supabase
        .from("user_department_professions")
        .select(
          `
          department_id,
          role,
          department:departments (
            id,
            name
          )
        `
        )
        .eq("user_id", userId)
        .eq("department_id", departmentId)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("user_department_access_levels")
        .select(
          `
          department_id,
          department:departments (
            id,
            name
          )
        `
        )
        .eq("user_id", userId)
        .eq("department_id", departmentId)
        .order("department_id", { ascending: true })
        .limit(1),
    ])

  if (membershipError) {
    console.error("Error checking requested department profession access:", membershipError)
  }

  if (membership) {
    return {
      id: membership.department_id,
      name: membership.department?.name ?? "Unknown",
      role: membership.role || null,
    }
  }

  if (accessError) {
    console.error("Error checking requested department access level:", accessError)
  }

  const accessAssignment = accessAssignments?.[0]
  if (accessAssignment) {
    return {
      id: accessAssignment.department_id,
      name: accessAssignment.department?.name ?? "Unknown",
      role: null,
    }
  }

  return null
}

/**
 * Fetch questions for the reporting form.
 * Department report questions are shown only to users with department-level
 * reporting permission, while profession questions follow the user's assigned profession.
 */
async function fetchRoleQuestions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  departmentId: string,
  userId: string
) {
  const getLegacyQuestionKeyFromMetadata = (metadata: unknown): string | null => {
    if (typeof metadata !== "object" || metadata === null) return null
    const value = (metadata as { legacy_question_key?: unknown }).legacy_question_key
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }

  const [{ data: questionRows, error: questionsError }, professionAssignmentResult, departmentPermissionResult] =
    await Promise.all([
      supabase
        .from("role_questions")
        .select("*")
        .eq("department_id", departmentId)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      getUserDepartmentProfessionAssignment(supabase, userId, departmentId).catch((error) => {
        console.error("Error fetching profession assignment for report questions:", error)
        return null
      }),
      userCanAnswerDepartmentQuestions(supabase, userId, departmentId).catch((error) => {
        console.error("Error checking department question access:", error)
        return false
      }),
    ])

  if (questionsError) {
    console.error("Error fetching report questions:", questionsError)
    return []
  }

  const questions = ((questionRows as DepartmentQuestionRow[] | null) || []).filter((question) => {
    if (isDepartmentReportQuestion(question)) {
      return departmentPermissionResult
    }

    return matchesProfessionQuestion(question, departmentId, professionAssignmentResult || {})
  })
  questions.sort((a, b) => (a?.display_order ?? 0) - (b?.display_order ?? 0))

  return questions.map((question) => {
    const directKey = typeof question.question_key === "string" ? question.question_key.trim() : ""
    const legacyKey = getLegacyQuestionKeyFromMetadata(question.metadata)
    return {
      ...question,
      question_key: directKey || legacyKey || question.id,
    }
  })
}

async function fetchExistingStandardEntryId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  departmentId: string,
  userId: string,
  date: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("captain_log_entries")
    .select("id")
    .eq("submitted_by_user_id", userId)
    .eq("entry_kind", "standard")
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

  // 6. Fetch role questions and initial standard-entry availability for the active reporting subject.
  const [roleQuestions, initialExistingStandardEntryId] = await Promise.all([
    fetchRoleQuestions(supabase, department.id, userId),
    fetchExistingStandardEntryId(supabase, department.id, userId, targetDate),
  ])

  return (
    <EntryFormMultistepClient
      departmentId={department.id}
      departmentName={department.name}
      date={targetDate}
      allowedDates={getAllowedDates()}
      initialExistingStandardEntryId={initialExistingStandardEntryId}
      initialRoleQuestions={roleQuestions}
    />
  )
}
