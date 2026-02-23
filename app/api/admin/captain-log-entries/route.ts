import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { adminSupabase } from "@/lib/supabase/admin"

// Enable dynamic route behavior
// This ensures we get fresh data on each request
export const dynamic = "force-dynamic"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

/**
 * GET /api/admin/captain-log-entries
 * Fetch all captain log entries with user profiles and custom responses
 * Admin and Super Admin only
 */
export async function GET() {
  try {
    // Check environment variables first
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("Missing Supabase environment variables")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const supabase = await createClient()

    // Check authentication with timeout
    let userData: { data: { user: any }; error: any } | null = null
    try {
      // Add timeout to prevent hanging requests
      const userPromise = supabase.auth.getUser()
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Auth check timeout")), 15000)
      )

      userData = (await Promise.race([userPromise, timeoutPromise])) as { data: { user: any }; error: any }
    } catch (timeoutError: any) {
      console.error("Auth check timeout:", timeoutError)
      return NextResponse.json({ error: "Authentication timeout. Please try refreshing the page." }, { status: 500 })
    }

    const {
      data: { user },
      error: authError,
    } = userData || { data: { user: null }, error: "Unknown error" }

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin with timeout
    let profileData: { data: any; error: any } | null = null
    try {
      // Add timeout to prevent hanging requests
      const profilePromise = supabase.from("user_profiles").select("role_id").eq("user_id", user.id).single()
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Profile check timeout")), 15000)
      )

      profileData = (await Promise.race([profilePromise, timeoutPromise])) as { data: any; error: any }
    } catch (timeoutError: any) {
      console.error("Profile check timeout:", timeoutError)
      return NextResponse.json({ error: "Profile check timeout. Please try refreshing the page." }, { status: 500 })
    }

    const { data: profile, error: profileError } = profileData || { data: null, error: "Unknown error" }

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    const isAdmin = (profile as any).role_id === ADMIN_ROLE_ID || (profile as any).role_id === SYSTEM_ADMIN_ROLE_ID

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    // Fetch all captain log entries
    // Use adminSupabase to bypass RLS and get ALL entries for admin view
    const { data: entries, error: entriesError } = await adminSupabase
      .from("captain_log_entries")
      .select("*")
      .order("created_at", { ascending: false })

    console.log("Entries fetched:", entries?.length || 0)
    console.log("Sample entry:", entries?.[0])

    if (entriesError) {
      console.error("Error fetching entries:", entriesError)
      return NextResponse.json({ error: "Failed to fetch entries", details: entriesError }, { status: 500 })
    }

    // Fetch ALL users (for dropdown - not just those with entries)
    // Use adminSupabase to bypass RLS and get all users
    let allUsers: any[] | null = null
    let allUsersError: any = null

    const activeUsersResult = await adminSupabase
      .from("user_profiles")
      .select("user_id, name, role_id, department_id")
      .eq("is_active", true)
      .order("name")

    allUsers = (activeUsersResult as any).data ?? null
    allUsersError = (activeUsersResult as any).error ?? null

    if (allUsersError || !allUsers || allUsers.length === 0) {
      const fallbackUsersResult = await adminSupabase
        .from("user_profiles")
        .select("user_id, name, role_id, department_id")
        .order("name")
      allUsers = (fallbackUsersResult as any).data ?? allUsers
      allUsersError = (fallbackUsersResult as any).error ?? allUsersError
    }

    console.log("Users fetched:", allUsers?.length || 0)
    console.log("Sample user:", allUsers?.[0])

    if (allUsersError) {
      console.error("Error fetching all users:", allUsersError)
    }

    // Fetch emails from auth.users for the user profiles
    let userEmailMap = new Map<string, string>()
    if (allUsers && allUsers.length > 0) {
      const userIds = (allUsers as any[]).map((u) => u.user_id)
      const { data: authUsers } = await adminSupabase.auth.admin.listUsers()

      if (authUsers?.users) {
        authUsers.users.forEach((authUser) => {
          if (userIds.includes(authUser.id)) {
            userEmailMap.set(authUser.id, authUser.email || "")
          }
        })
      }
    }

    // Fetch ALL professional roles (for dropdown)
    // Use adminSupabase to bypass RLS and get department roles
    const { data: allRoles, error: allRolesError } = await adminSupabase
      .from("department_roles")
      .select("key as id, label as name")
      .eq("is_active", true)
      .order("department_id, sort_order")

    if (allRolesError) {
      console.error("Error fetching all roles:", allRolesError)
    }

    // Fetch ALL departments (for dropdown)
    // Use adminSupabase to bypass RLS
    const { data: allDepartments, error: allDeptsError } = await adminSupabase
      .from("departments")
      .select("id, name")
      .order("name")

    if (allDeptsError) {
      console.error("Error fetching all departments:", allDeptsError)
    }

    const roleMap = new Map((allRoles as any[])?.map((r) => [r.id, r.name]) || [])
    const deptMap = new Map((allDepartments as any[])?.map((d) => [d.id, d.name]) || [])

    const allUserIds = (allUsers as any[])?.map((u) => u.user_id).filter(Boolean) || []
    const { data: professionRows, error: professionsError } =
      allUserIds.length > 0
        ? await adminSupabase
            .from("user_department_roles")
            .select("user_id, department_id, role, department_roles:role(label)")
            .in("user_id", allUserIds)
            .eq("is_active", true)
        : { data: [], error: null }

    if (professionsError) {
      console.error("Error fetching user department roles:", professionsError)
    }

    const professionByUserId = new Map<
      string,
      { department_id: string | null; role_id: string | null; role_name: string | null }
    >()
    ;(professionRows as any[])?.forEach((row) => {
      const userId = typeof row?.user_id === "string" ? row.user_id : null
      if (!userId) return

      const departmentId = typeof row?.department_id === "string" ? row.department_id : null
      const roleKey = typeof row?.role === "string" ? row.role : null
      const roleName = typeof row?.department_roles?.label === "string" ? row.department_roles.label : null

      professionByUserId.set(userId, { department_id: departmentId, role_id: roleKey, role_name: roleName })
    })

    const normalizedUsers =
      (allUsers as any[])?.map((u) => ({
        user_id: u.user_id,
        name: u.name || "Unknown User",
        email: userEmailMap.get(u.user_id) || "",
        role_name: roleMap.get(u.role_id) || "Unknown",
        department_name: deptMap.get(u.department_id) || null,
        department_id: u.department_id || null,
        profession_role_id: professionByUserId.get(u.user_id)?.role_id || null,
        profession_role_name: professionByUserId.get(u.user_id)?.role_name || null,
      })) || []

    // If no entries, return empty result with filter options
    if (!entries || entries.length === 0) {
      return NextResponse.json({
        entries: [],
        users: normalizedUsers,
        roles: (allRoles as any[])?.map((r) => ({ id: r.id, name: r.name })) || [],
        departments: (allDepartments as any[])?.map((d) => ({ id: d.id, name: d.name })) || [],
      })
    }

    const userMap = new Map(normalizedUsers.map((u) => [u.user_id, u]))

    // Fetch custom responses for all entries
    // Use adminSupabase to bypass RLS
    const entryIds = (entries as any[]).map((e) => e.id)
    const { data: customResponses, error: responsesError } = await adminSupabase
      .from("custom_responses")
      .select("*")
      .in("entry_id", entryIds)
      .order("timestamp")

    if (responsesError) {
      console.error("Error fetching custom responses:", responsesError)
    }

    // Create responses lookup map
    const responsesMap = new Map<string, any[]>()
    ;(customResponses as any[])?.forEach((response) => {
      const entryResponses = responsesMap.get(response.entry_id) || []
      entryResponses.push({
        question_id: response.question_id,
        question_key: response.question_key,
        question_label: response.question_label,
        question_type: response.question_type,
        value: response.value,
      })
      responsesMap.set(response.entry_id, entryResponses)
    })

    const entryDeptIds = Array.from(
      new Set(
        (entries as any[])
          .map((e) => (typeof (e as any)?.department_id === "string" ? (e as any).department_id : null))
          .filter((id): id is string => Boolean(id))
      )
    )
    const entryProfessionRoleIds = Array.from(
      new Set(
        (entries as any[])
          .map((e) => professionByUserId.get((e as any).user_id)?.role_id || null)
          .filter((id): id is string => Boolean(id))
      )
    )

    const [{ data: deptQuestions, error: deptQuestionsError }, { data: roleQuestions, error: roleQuestionsError }] =
      await Promise.all([
        entryDeptIds.length > 0
          ? adminSupabase
              .from("role_questions")
              .select("department_id")
              .in("department_id", entryDeptIds)
              .eq("is_active", true)
          : Promise.resolve({ data: [], error: null }),
        entryProfessionRoleIds.length > 0
          ? adminSupabase
              .from("role_questions")
              .select("role_id")
              .in("role_id", entryProfessionRoleIds)
              .eq("is_active", true)
          : Promise.resolve({ data: [], error: null }),
      ])

    if (deptQuestionsError) {
      console.error("Error fetching department role questions:", deptQuestionsError)
    }
    if (roleQuestionsError) {
      console.error("Error fetching profession role questions:", roleQuestionsError)
    }

    const deptQuestionCountByDepartmentId = new Map<string, number>()
    ;(deptQuestions as any[])?.forEach((row) => {
      const departmentId = typeof row?.department_id === "string" ? row.department_id : null
      if (!departmentId) return
      deptQuestionCountByDepartmentId.set(departmentId, (deptQuestionCountByDepartmentId.get(departmentId) || 0) + 1)
    })

    const roleQuestionCountByRoleId = new Map<string, number>()
    ;(roleQuestions as any[])?.forEach((row) => {
      const roleId = typeof row?.role_id === "string" ? row.role_id : null
      if (!roleId) return
      roleQuestionCountByRoleId.set(roleId, (roleQuestionCountByRoleId.get(roleId) || 0) + 1)
    })

    // Enrich entries with user profiles and custom responses
    const enrichedEntries = (entries as any[]).map((entry) => {
      const profession = professionByUserId.get(entry.user_id) || null
      const departmentId = typeof (entry as any)?.department_id === "string" ? (entry as any).department_id : null
      const deptQuestionCount = departmentId ? deptQuestionCountByDepartmentId.get(departmentId) || 0 : 0
      const roleQuestionCount = profession?.role_id ? roleQuestionCountByRoleId.get(profession.role_id) || 0 : 0

      return {
        ...entry,
        user_profile: userMap.get(entry.user_id) || null,
        custom_responses: responsesMap.get(entry.id) || [],
        profession_role_id: profession?.role_id || null,
        profession_role_name: profession?.role_name || null,
        total_questions: deptQuestionCount + roleQuestionCount,
      }
    })

    // Return enriched entries along with filter options
    return NextResponse.json({
      entries: enrichedEntries,
      users: normalizedUsers,
      roles: (allRoles as any[])?.map((r) => ({ id: r.id, name: r.name })) || [],
      departments: (allDepartments as any[])?.map((d) => ({ id: d.id, name: d.name })) || [],
    })
  } catch (error) {
    console.error("Unexpected error in GET /api/admin/captain-log-entries:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
