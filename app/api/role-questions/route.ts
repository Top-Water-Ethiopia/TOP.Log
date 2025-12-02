import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { SupabaseClient } from "@supabase/supabase-js"

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

    // Get user's role
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role_id")
      .eq("user_id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      )
    }

    // Type assertion for profile since we know it has role_id
    const userProfile = profile as { role_id: string }

    // Get query parameter to determine if this is for a report
    const { searchParams } = new URL(request.url)
    const forReport = searchParams.get("forReport") === "true"

    // Check if user is super admin or admin
    const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"
    const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
    const isSuperAdmin = userProfile.role_id === SUPER_ADMIN_ROLE_ID
    const isAdmin = userProfile.role_id === ADMIN_ROLE_ID || isSuperAdmin

    // Get questions for user's role
    // For reports: ALL users (including admins) see only their own role's active questions
    // For admin panel: Admins can see ALL questions (including inactive), regular users only see active questions for their role
    let questionsQuery = supabase
      .from("role_questions")
      .select(`
        *,
        role:roles(*)
      `)
      .order("display_order", { ascending: true })
      .limit(10000) // Ensure we fetch all questions (Supabase default limit is 1000)

    if (forReport) {
      // For reports, everyone sees only their own role's active questions
      questionsQuery = questionsQuery
        .eq("is_active", true)
        .eq("role_id", userProfile.role_id)
    } else if (!isAdmin) {
      // Regular users (non-admin panel) only see active questions for their role
      questionsQuery = questionsQuery
        .eq("is_active", true)
        .eq("role_id", userProfile.role_id)
    }
    // Admins and super admins (admin panel) see all questions (no filters - includes inactive questions)

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
      ? `report (role ${userProfile.role_id})` 
      : isAdmin 
        ? 'admin/super admin (all roles)' 
        : `role ${userProfile.role_id}`
    console.log(`✅ Fetched ${processedQuestions.length || 0} questions for ${context}`)
    
    return NextResponse.json(processedQuestions)
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}