import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCompletionStatus, getReportStatus } from "@/lib/completion-status"
import { LogCompleteState } from "@/components/log-complete-state"
import { EntryFormMultistepClient } from "./client"

interface SearchParams {
  date?: string
  template?: string
}

function buildQueryString(params: SearchParams): string {
  const query = new URLSearchParams()
  if (params.date) query.set("date", params.date)
  if (params.template) query.set("template", params.template)
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
): Promise<{ id: string; name: string; role: string } | null> {
  const { data, error } = await supabase
    .from("user_department_roles")
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
    .single()

  if (error || !data) {
    console.error("Error fetching user department:", error)
    return null
  }

  return {
    id: data.department_id,
    name: data.department?.name ?? "Unknown",
    role: data.role || "member",
  }
}

/**
 * Fetch role-specific questions for a department.
 * Combines department-wide questions (department_role IS NULL) with
 * role-scoped questions matching the user's department role.
 */
async function fetchRoleQuestions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  departmentId: string,
  departmentRole: string
) {
  const getLegacyQuestionKeyFromMetadata = (metadata: unknown): string | null => {
    if (typeof metadata !== "object" || metadata === null) return null
    const value = (metadata as { legacy_question_key?: unknown }).legacy_question_key
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }

  const [departmentScopedResult, roleScopedResult] = await Promise.all([
    supabase
      .from("role_questions")
      .select("*")
      .eq("department_id", departmentId)
      .is("department_role", null)
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("role_questions")
      .select("*")
      .eq("department_id", departmentId)
      .eq("department_role", departmentRole)
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
  ])

  if (departmentScopedResult.error) {
    console.error("Error fetching department-scoped questions:", departmentScopedResult.error)
    return []
  }

  if (roleScopedResult.error) {
    console.error("Error fetching department-role questions:", roleScopedResult.error)
    return []
  }

  const questions = [...(departmentScopedResult.data || []), ...(roleScopedResult.data || [])]
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

  // 3. Validate date format only; create eligibility is resolved from report status below.
  const dateValidation = validateLogDate(params.date)
  if (params.date && !dateValidation.valid) {
    redirect(
      `/logs/new${buildQueryString({
        ...params,
        date: undefined,
      })}`
    )
  }

  // 4. Fetch user's single department
  const department = await fetchUserDepartment(supabase, userId)

  if (!department) {
    redirect("/?error=no_department")
  }

  // 5. Compute report status for this department
  const reportStatus = await getReportStatus(supabase, userId, department.id)

  if (reportStatus.isFullySubmitted) {
    const completionStatus = await getCompletionStatus(supabase, userId, department.id)
    return (
      <LogCompleteState
        completedDates={completionStatus.completedDates}
        nextAvailableDate={completionStatus.nextAvailableDate}
        hoursUntilNextAvailable={completionStatus.hoursUntilNextAvailable}
        streak={completionStatus.totalCompleted}
      />
    )
  }

  const fallbackDate = reportStatus.missingDates[0]
  const targetDate = params.date && reportStatus.missingDates.includes(params.date) ? params.date : fallbackDate

  if (!targetDate) {
    redirect("/logs")
  }

  // Canonicalize URL to ensure date param is set
  const canonicalQuery = buildQueryString({
    ...params,
    date: targetDate,
  })

  if (`/logs/new${buildQueryString(params)}` !== `/logs/new${canonicalQuery}`) {
    redirect(`/logs/new${canonicalQuery}`)
  }

  // 6. Fetch role questions — pass role directly, no redundant query
  const roleQuestions = await fetchRoleQuestions(supabase, department.id, department.role)

  return (
    <EntryFormMultistepClient
      userId={userId}
      departmentId={department.id}
      departmentName={department.name}
      date={targetDate}
      allowedDates={reportStatus.missingDates}
      initialRoleQuestions={roleQuestions}
      template={params.template}
    />
  )
}
