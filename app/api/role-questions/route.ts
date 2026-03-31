import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { SupabaseClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Define the role question type
interface RoleQuestion {
  id: string
  department_id: string | null
  department_role: string | null
  question_key: string
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

type DbRoleQuestionRow = {
  id: string
  department_id: string | null
  department_role: string | null
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
  question_key?: string | null
}

function getLegacyQuestionKeyFromMetadata(metadata: unknown): string | null {
  if (typeof metadata !== "object" || metadata === null) return null
  const value = (metadata as { legacy_question_key?: unknown }).legacy_question_key
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

async function getUserDepartmentRole(
  supabase: SupabaseClient,
  userId: string,
  departmentId: string
): Promise<string | null> {
  // First try to get the role from user_department_professions (for role-based questions)
  const { data: membership, error: membershipError } = await supabase
    .from("user_department_professions")
    .select("role")
    .eq("user_id", userId)
    .eq("department_id", departmentId)
    .eq("is_active", true)
    .maybeSingle()

  if (!membershipError && membership && typeof membership.role === "string") {
    return membership.role
  }

  return null
}

async function userCanAnswerDepartmentQuestions(
  supabase: SupabaseClient,
  userId: string,
  departmentId: string
): Promise<boolean> {
  const { data: assignment, error: assignmentError } = await supabase
    .from("user_department_access_levels")
    .select("access_level_id")
    .eq("user_id", userId)
    .eq("department_id", departmentId)
    .maybeSingle()

  if (assignmentError) throw assignmentError
  const accessLevelId = assignment?.access_level_id
  if (typeof accessLevelId !== "string" || !accessLevelId) return false

  // First, get the permission_definition_id for department_questions.answer
  const { data: permDef } = await supabase
    .from("permission_definitions")
    .select("id")
    .eq("resource", "department_questions")
    .eq("action", "answer")
    .single()

  if (!permDef) return false

  const { data: perm, error: permError } = await supabase
    .from("department_access_level_permissions")
    .select("effect")
    .eq("access_level_id", accessLevelId)
    .eq("permission_definition_id", permDef.id)
    .limit(1)
    .maybeSingle()

  if (permError) throw permError
  return (perm?.effect || "allow") === "allow"
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's system role (and legacy default department)
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role_id, department_id")
      .eq("user_id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    // Type assertion for profile since we know it has role_id
    const userProfile = profile as { role_id: string; department_id: string | null }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const forReport = searchParams.get("forReport") === "true"
    const requestedDepartmentId = searchParams.get("departmentId")
    const scope = searchParams.get("scope")

    // Check if user is admin
    const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
    const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"
    const isAdmin = userProfile.role_id === ADMIN_ROLE_ID || userProfile.role_id === SYSTEM_ADMIN_ROLE_ID

    // Department-scoped questions should only be answerable in reports by department leads.
    // We gate that via department-scoped RBAC based on user_department_access_levels + department_access_level_permissions.
    let canAnswerDepartmentQuestions = isAdmin
    const departmentId =
      forReport || !isAdmin ? requestedDepartmentId || userProfile.department_id || null : requestedDepartmentId || null

    // Determine role scope for fetching questions.
    // - For reports: everyone (including admins) sees ONLY their department profession role's active questions.
    // - For non-admin users: only active questions for their department profession role.
    // - For admin panel: admins can fetch ALL questions (no filters) when departmentId is not provided.
    // - If admins provide departmentId, return all questions for roles in that department.

    const requiresDepartmentContext = forReport || !isAdmin
    if (requiresDepartmentContext && !departmentId) {
      return NextResponse.json(
        { error: "departmentId is required", message: "Select a department to load role questions" },
        { status: 400 }
      )
    }

    if (!isAdmin && forReport && departmentId) {
      try {
        canAnswerDepartmentQuestions = await userCanAnswerDepartmentQuestions(supabase, user.id, departmentId)
      } catch (deptPermError) {
        console.error("Error checking department access level permissions:", deptPermError)
        canAnswerDepartmentQuestions = false
      }
    }

    const makeQuestionsQuery = () =>
      supabase.from("role_questions").select("*").order("display_order", { ascending: true }).limit(10000) // Ensure we fetch all questions (Supabase default limit is 1000)

    let questions: DbRoleQuestionRow[] = []

    if (isAdmin && !departmentId) {
      const { data: allQuestions, error: questionsError } = await makeQuestionsQuery()
      if (questionsError) {
        console.error("Error fetching role questions:", questionsError)
        console.error("Error details:", {
          message: questionsError.message,
          code: questionsError.code,
          details: questionsError.details,
          hint: questionsError.hint,
        })
        return NextResponse.json(
          { error: "Failed to fetch questions", details: questionsError.message },
          { status: 500 }
        )
      }
      questions = (allQuestions as unknown as DbRoleQuestionRow[]) || []
    } else if (departmentId) {
      if (scope === "department_only") {
        if (!isAdmin) {
          return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        const deptOnlyQuery = makeQuestionsQuery().eq("department_id", departmentId)
        if (!isAdmin || forReport) {
          deptOnlyQuery.eq("is_active", true)
        }

        const { data: deptOnlyQuestions, error: deptOnlyError } = await deptOnlyQuery
        if (deptOnlyError) {
          console.error("Error fetching department-only questions:", deptOnlyError)
          return NextResponse.json(
            { error: "Failed to fetch questions", details: deptOnlyError.message },
            { status: 500 }
          )
        }

        questions = (deptOnlyQuestions as unknown as DbRoleQuestionRow[]) || []
        questions.sort((a, b) => (a?.display_order ?? 0) - (b?.display_order ?? 0))
      } else {
        // Always include department-scoped questions when a department context is present.
        const deptQuery =
          !forReport || isAdmin || canAnswerDepartmentQuestions
            ? makeQuestionsQuery().eq("department_id", departmentId)
            : null

        // For role-specific questions, query by department_role instead of role_id
        const userDepartmentRole = requiresDepartmentContext
          ? await getUserDepartmentRole(supabase, user.id, departmentId)
          : null
        const roleQuery = userDepartmentRole
          ? makeQuestionsQuery().eq("department_id", departmentId).eq("department_role", userDepartmentRole)
          : null

        if (!isAdmin) {
          if (deptQuery) deptQuery.eq("is_active", true)
          if (roleQuery) roleQuery.eq("is_active", true)
        } else if (forReport) {
          // forReport forces is_active even for admins.
          if (deptQuery) deptQuery.eq("is_active", true)
          if (roleQuery) roleQuery.eq("is_active", true)
        }

        const emptyDeptResult = Promise.resolve({ data: [] as DbRoleQuestionRow[], error: null as null })
        const emptyRoleResult = Promise.resolve({ data: [] as DbRoleQuestionRow[], error: null as null })
        const [{ data: deptQuestions, error: deptError }, roleResult] = await Promise.all([
          deptQuery ? deptQuery : emptyDeptResult,
          roleQuery ? roleQuery : emptyRoleResult,
        ])

        if (deptError) {
          console.error("Error fetching department questions:", deptError)
          return NextResponse.json({ error: "Failed to fetch questions", details: deptError.message }, { status: 500 })
        }
        if (roleResult?.error) {
          console.error("Error fetching role questions:", roleResult.error)
          return NextResponse.json(
            { error: "Failed to fetch questions", details: roleResult.error.message },
            { status: 500 }
          )
        }

        // Admin department-scoped view should include all role questions for roles in the department.
        if (isAdmin && !forReport) {
          const { data: deptRoles, error: deptRolesError } = await supabase
            .from("user_department_professions")
            .select("role")
            .eq("department_id", departmentId)
            .eq("is_active", true)
            .limit(10000)

          if (deptRolesError) {
            return NextResponse.json(
              { error: "Failed to load department roles", message: deptRolesError.message },
              { status: 500 }
            )
          }

          const departmentRoles = (deptRoles || [])
            .map((r) => (typeof r.role === "string" ? r.role : null))
            .filter((role): role is string => Boolean(role))

          if (departmentRoles.length > 0) {
            const { data: deptRoleQuestions, error: deptRoleQuestionsError } = await makeQuestionsQuery()
              .eq("department_id", departmentId)
              .in("department_role", departmentRoles)

            if (deptRoleQuestionsError) {
              console.error("Error fetching department role questions:", deptRoleQuestionsError)
              return NextResponse.json(
                { error: "Failed to fetch questions", details: deptRoleQuestionsError.message },
                { status: 500 }
              )
            }

            questions = [
              ...(((deptQuestions as unknown as DbRoleQuestionRow[]) || []) as DbRoleQuestionRow[]),
              ...(((deptRoleQuestions as unknown as DbRoleQuestionRow[]) || []) as DbRoleQuestionRow[]),
            ]
          } else {
            questions = ((deptQuestions as unknown as DbRoleQuestionRow[]) || []) as DbRoleQuestionRow[]
          }
        } else {
          questions = [
            ...(((deptQuestions as unknown as DbRoleQuestionRow[]) || []) as DbRoleQuestionRow[]),
            ...(((roleResult?.data as unknown as DbRoleQuestionRow[]) || []) as DbRoleQuestionRow[]),
          ]
        }

        questions.sort((a, b) => (a?.display_order ?? 0) - (b?.display_order ?? 0))
      }
    }

    const processedQuestions: RoleQuestion[] =
      (questions || []).map((question: DbRoleQuestionRow) => {
        const directKey = typeof question.question_key === "string" ? question.question_key.trim() : ""
        const legacyKey = getLegacyQuestionKeyFromMetadata(question.metadata)
        const resolvedKey = directKey || legacyKey || question.id

        return {
          ...(question as unknown as Omit<RoleQuestion, "question_key">),
          question_key: resolvedKey,
        }
      }) || []

    return NextResponse.json(processedQuestions)
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
