import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
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

    // Check if user is super admin or admin
    const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"
    const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
    const isSuperAdmin = profile.role_id === SUPER_ADMIN_ROLE_ID
    const isAdmin = profile.role_id === ADMIN_ROLE_ID || isSuperAdmin

    // Get questions for user's role
    // Super admins and admins can see ALL questions (including inactive), regular users only see active questions for their role
    let questionsQuery = supabase
      .from("role_questions")
      .select("*")
      .order("display_order", { ascending: true })
      .limit(10000) // Ensure we fetch all questions (Supabase default limit is 1000)

    if (!isAdmin) {
      // Regular users only see active questions for their role
      questionsQuery = questionsQuery
        .eq("is_active", true)
        .eq("role_id", profile.role_id)
    }
    // Admins and super admins see all questions (no filters - includes inactive questions)

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

    console.log(`✅ Fetched ${questions?.length || 0} questions for ${isAdmin ? 'admin/super admin (all roles)' : `role ${profile.role_id}`}`)
    
    return NextResponse.json(questions || [])
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}



