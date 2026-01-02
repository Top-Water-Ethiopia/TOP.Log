import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Define the role question type
interface RoleQuestion {
  id: string
  role_id: string
  question_key: string
  question_label: string
  question_type: string
  question_description: string | null
  placeholder: string | null
  options: any
  is_required: boolean
  display_order: number
  validation_rules: any
  is_active: boolean
  created_at: string
  updated_at: string
  metadata: any
  role?: any
  question_title?: string | null
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get user's system role (and legacy default department)
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role_id, department_id")
      .eq("user_id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      )
    }

    // Type assertion for profile since we know it has role_id
    const userProfile = profile as { role_id: string; department_id: string | null }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const forReport = searchParams.get("forReport") === "true"
    const requestedDepartmentId = searchParams.get("departmentId")
    const departmentId = requestedDepartmentId || userProfile.department_id || null

    // Check if user is super admin or admin
    const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"
    const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
    const isSuperAdmin = userProfile.role_id === SUPER_ADMIN_ROLE_ID
    const isAdmin = userProfile.role_id === ADMIN_ROLE_ID || isSuperAdmin

    // Determine role scope for fetching questions.
    // - For reports: everyone (including admins) sees ONLY their department profession role's active questions.
    // - For non-admin users: only active questions for their department profession role.
    // - For admin panel: admins can fetch ALL questions (no filters) when departmentId is not provided.
    // - If admins provide departmentId, return all questions for roles in that department.

    const requiresDepartmentContext = forReport || !isAdmin
    if (requiresDepartmentContext && !departmentId) {
      return NextResponse.json(
        { error: "departmentId is required", message: "Select a department to load role questions" },
        { status: 400 },
      )
    }

    let resolvedRoleId: string | null = null

    if (departmentId) {
      if (requiresDepartmentContext) {
        const { data: professionRow, error: professionError } = await supabase
          .from("user_department_professions")
          .select("role_id")
          .eq("user_id", user.id)
          .eq("department_id", departmentId)
          .eq("is_active", true)
          .maybeSingle()

        if (professionError) {
          return NextResponse.json(
            { error: "Failed to resolve profession role", message: professionError.message },
            { status: 500 },
          )
        }

        if (!professionRow?.role_id) {
          return NextResponse.json(
            {
              error: "Profession role not assigned",
              message: "You do not have a profession role assigned for this department",
            },
            { status: 404 },
          )
        }

        resolvedRoleId = professionRow.role_id as string
      }
    }

    let questionsQuery = supabase
      .from("role_questions")
      .select(`
        *,
        role:roles(*)
      `)
      .order("display_order", { ascending: true })
      .limit(10000) // Ensure we fetch all questions (Supabase default limit is 1000)

    if (forReport) {
      if (!resolvedRoleId) {
        return NextResponse.json(
          { error: "Profession role not resolved", message: "Unable to resolve profession role for this department" },
          { status: 404 },
        )
      }
      questionsQuery = questionsQuery.eq("is_active", true).eq("role_id", resolvedRoleId)
    } else if (!isAdmin) {
      if (!resolvedRoleId) {
        return NextResponse.json(
          { error: "Profession role not resolved", message: "Unable to resolve profession role for this department" },
          { status: 404 },
        )
      }
      questionsQuery = questionsQuery.eq("is_active", true).eq("role_id", resolvedRoleId)
    } else if (departmentId) {
      // Admin view: filter to a department if requested
      const { data: deptRoles, error: deptRolesError } = await supabase
        .from("roles")
        .select("id")
        .eq("department_id", departmentId)
        .limit(10000)

      if (deptRolesError) {
        return NextResponse.json(
          { error: "Failed to load department roles", message: deptRolesError.message },
          { status: 500 },
        )
      }

      const roleIds = (deptRoles || []).map((r: any) => r.id).filter(Boolean)
      if (roleIds.length === 0) {
        return NextResponse.json([])
      }
      questionsQuery = questionsQuery.in("role_id", roleIds)
    }

    const { data: questions, error: questionsError } = await questionsQuery

    if (questionsError) {
      console.error("Error fetching role questions:", questionsError)
      console.error("Error details:", {
        message: questionsError.message,
        code: questionsError.code,
        details: questionsError.details,
        hint: questionsError.hint
      })
      return NextResponse.json(
        { error: "Failed to fetch questions", details: questionsError.message },
        { status: 500 }
      )
    }

    // Process questions to extract question_title from metadata
    const processedQuestions: RoleQuestion[] = questions?.map((question: any) => ({
      ...question,
      question_title: question.metadata?.question_title || null
    })) || []

    const context = forReport
      ? `report (department ${departmentId}, role ${resolvedRoleId})`
      : isAdmin
        ? departmentId
          ? `admin/super admin (department ${departmentId})`
          : "admin/super admin (all roles)"
        : `department ${departmentId}, role ${resolvedRoleId}`
    
    return NextResponse.json(processedQuestions)
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}