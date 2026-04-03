import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  isDepartmentReportQuestion,
  matchesProfessionQuestion,
  type DepartmentProfessionIdentity,
} from "@/lib/reporting-model"
import {
  getUserDepartmentProfessionAssignment,
  userCanAnswerDepartmentQuestions,
} from "@/lib/server/department-reporting"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface RoleQuestion {
  id: string
  department_id: string | null
  department_profession_id: string | null
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
  department_profession?: {
    id: string
    key: string
    label: string
  } | null
}

type DbRoleQuestionRow = Omit<RoleQuestion, "question_key"> & {
  question_key?: string | null
}

function getLegacyQuestionKeyFromMetadata(metadata: unknown): string | null {
  if (typeof metadata !== "object" || metadata === null) return null
  const value = (metadata as { legacy_question_key?: unknown }).legacy_question_key
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role_id, department_id")
      .eq("user_id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    const userProfile = profile as { role_id: string; department_id: string | null }
    const { searchParams } = new URL(request.url)
    const forReport = searchParams.get("forReport") === "true"
    const requestedDepartmentId = searchParams.get("departmentId")
    const scope = searchParams.get("scope")

    const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
    const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"
    const isAdmin = userProfile.role_id === ADMIN_ROLE_ID || userProfile.role_id === SYSTEM_ADMIN_ROLE_ID

    const departmentId =
      forReport || !isAdmin ? requestedDepartmentId || userProfile.department_id || null : requestedDepartmentId || null

    const requiresDepartmentContext = forReport || !isAdmin
    if (requiresDepartmentContext && !departmentId) {
      return NextResponse.json(
        { error: "departmentId is required", message: "Select a department to load role questions" },
        { status: 400 }
      )
    }

    let canAnswerDepartmentQuestions = isAdmin
    if (departmentId && forReport && !isAdmin) {
      try {
        canAnswerDepartmentQuestions = await userCanAnswerDepartmentQuestions(supabase, user.id, departmentId)
      } catch (departmentPermissionError) {
        console.error("Error checking department question permissions:", departmentPermissionError)
        canAnswerDepartmentQuestions = false
      }
    }

    const makeQuestionsQuery = () =>
      supabase
        .from("role_questions")
        .select("*, department_profession:department_professions(id, key, label)")
        .order("display_order", { ascending: true })
        .limit(10000)

    let questions: DbRoleQuestionRow[] = []

    if (isAdmin && !departmentId) {
      const { data: allQuestions, error: allQuestionsError } = await makeQuestionsQuery()
      if (allQuestionsError) {
        return NextResponse.json(
          { error: "Failed to fetch questions", details: allQuestionsError.message },
          { status: 500 }
        )
      }
      questions = (allQuestions as unknown as DbRoleQuestionRow[]) || []
    } else if (departmentId) {
      const scopedQuery = makeQuestionsQuery().eq("department_id", departmentId)
      if (!isAdmin || forReport) {
        scopedQuery.eq("is_active", true)
      }

      const { data: departmentQuestions, error: departmentQuestionsError } = await scopedQuery
      if (departmentQuestionsError) {
        return NextResponse.json(
          { error: "Failed to fetch questions", details: departmentQuestionsError.message },
          { status: 500 }
        )
      }

      const scopedQuestions = ((departmentQuestions as unknown as DbRoleQuestionRow[]) || []).filter(
        (question) => question.department_id === departmentId
      )

      if (scope === "department_only") {
        if (!isAdmin) {
          return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }
        questions = scopedQuestions.filter((question) => isDepartmentReportQuestion(question))
      } else if (isAdmin && !forReport) {
        questions = scopedQuestions
      } else {
        let professionAssignment: DepartmentProfessionIdentity = {}

        try {
          const assignment = await getUserDepartmentProfessionAssignment(supabase, user.id, departmentId)
          professionAssignment = assignment || {}
        } catch (professionError) {
          console.error("Error loading profession assignment for role questions:", professionError)
        }

        questions = scopedQuestions.filter((question) => {
          if (isDepartmentReportQuestion(question)) {
            return canAnswerDepartmentQuestions
          }

          return matchesProfessionQuestion(question, departmentId, professionAssignment)
        })
      }
    }

    const processedQuestions: RoleQuestion[] = (questions || []).map((question) => {
      const directKey = typeof question.question_key === "string" ? question.question_key.trim() : ""
      const legacyKey = getLegacyQuestionKeyFromMetadata(question.metadata)
      const resolvedKey = directKey || legacyKey || question.id

      return {
        ...(question as Omit<RoleQuestion, "question_key">),
        question_key: resolvedKey,
      }
    })

    return NextResponse.json(processedQuestions)
  } catch (error) {
    console.error("Unexpected error loading role questions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
