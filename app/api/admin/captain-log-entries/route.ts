import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { canViewDepartmentLogs } from "@/lib/logs/visibility"

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

    // Check for management permissions if not system admin
    let accessibleDepartmentIds: string[] = []
    let isManager = isAdmin
    
    if (!isAdmin) {
      // Query memberships for management roles
      const { data: memberships } = await adminSupabase
        .from("user_department_memberships")
        .select("department_id, role:roles(name)")
        .eq("user_id", user.id)
        .eq("membership_type", "access_level")
        .eq("is_active", true)
      
      const managerDepts = (memberships || [])
        .filter(m => {
          const roleName = (m.role as any)?.name || (Array.isArray(m.role) && m.role[0]?.name)
          return canViewDepartmentLogs(roleName)
        })
        .map(m => m.department_id)
      
      if (managerDepts.length > 0) {
        isManager = true
        accessibleDepartmentIds = managerDepts
      }
    }

    if (!isManager) {
      return NextResponse.json({ error: "Forbidden: Management access required" }, { status: 403 })
    }

    // Fetch captain log entries
    // Use adminSupabase to bypass RLS and get ALL entries for authorized departments
    let entriesQuery = adminSupabase.from("captain_log_entries").select("*")
    
    if (!isAdmin) {
      entriesQuery = entriesQuery.in("subject_department_id", accessibleDepartmentIds)
    }

    const { data: entries, error: entriesError } = await entriesQuery.order("created_at", { ascending: false })

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

    let usersQuery = adminSupabase
      .from("user_profiles")
      .select("user_id, name, role_id, department_id")
      .eq("is_active", true)
    
    if (!isAdmin) {
      usersQuery = usersQuery.in("department_id", accessibleDepartmentIds)
    }

    const activeUsersResult = await usersQuery.order("name")

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
      .from("roles")
      .select("id, name, display_name")
      .eq("type", "profession")
      .eq("is_active", true)

    if (allRolesError) {
      console.error("Error fetching all roles:", allRolesError)
    }

    // Fetch ALL departments (for dropdown)
    // Use adminSupabase to bypass RLS
    let deptsQuery = adminSupabase.from("departments").select("id, name")
    
    if (!isAdmin) {
      deptsQuery = deptsQuery.in("id", accessibleDepartmentIds)
    }

    const { data: allDepartments, error: allDeptsError } = await deptsQuery.order("name")

    if (allDeptsError) {
      console.error("Error fetching all departments:", allDeptsError)
    }

    const roleMap = new Map((allRoles as any[])?.map((r) => [r.id, r.display_name || r.name]) || [])
    const deptMap = new Map((allDepartments as any[])?.map((d) => [d.id, d.name]) || [])

    const allUserIds = (allUsers as any[])?.map((u) => u.user_id).filter(Boolean) || []
    const professionByUserId = new Map<
      string,
      { department_id: string | null; role_id: string | null; role_key: string | null; role_name: string | null }
    >()

    if (allUserIds.length > 0) {
      const { data: membershipData, error: membershipError } = await adminSupabase
        .from("user_department_memberships")
        .select(
          `
          user_id,
          department_id,
          role_id,
          membership_type,
          role:roles (
            id,
            name,
            display_name,
            type
          )
        `
        )
        .in("user_id", allUserIds)
        .eq("is_active", true)

      if (membershipError) {
        console.error("Error fetching memberships:", membershipError)
      } else {
        const rows = (membershipData || []) as any[]
        for (const row of rows) {
          const userId = row.user_id
          if (!userId || professionByUserId.has(userId)) continue

          const roleResult = Array.isArray(row.role) ? row.role[0] : row.role
          if (row.membership_type === "profession") {
            professionByUserId.set(userId, {
              department_id: row.department_id,
              role_id: row.role_id,
              role_key: roleResult?.name || null,
              role_name: roleResult?.display_name || roleResult?.name || null,
            })
          }
        }
      }
    }

    const accessRoleByUserId = new Map<string, { department_id: string | null; role_name: string | null }>()
    // Consolidated above - we could extract access levels here if needed but for now we skip redundant queries

    const normalizedUsers =
      (allUsers as any[])?.map((u) => ({
        user_id: u.user_id,
        name: u.name || "Unknown User",
        email: userEmailMap.get(u.user_id) || "",
        role_name: roleMap.get(u.role_id) || "Unknown",
        department_name: deptMap.get(u.department_id) || null,
        department_id: u.department_id || null,
        profession_role_id: professionByUserId.get(u.user_id)?.role_id || null,
        profession_role_name:
          professionByUserId.get(u.user_id)?.role_name || accessRoleByUserId.get(u.user_id)?.role_name || null,
        effective_department_role_name:
          professionByUserId.get(u.user_id)?.role_name || accessRoleByUserId.get(u.user_id)?.role_name || null,
      })) || []

    // If no entries, return empty result with filter options
    if (!entries || entries.length === 0) {
      return NextResponse.json({
        entries: [],
        users: normalizedUsers,
        roles: (allRoles as any[])?.map((r) => ({ id: r.id, name: r.label })) || [],
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
          .map((e) =>
            typeof (e as any)?.subject_department_id === "string"
              ? (e as any).subject_department_id
              : typeof (e as any)?.department_id === "string"
                ? (e as any).department_id
                : null
          )
          .filter((id): id is string => Boolean(id))
      )
    )
    const entryProfessionIds = Array.from(
      new Set(
        (entries as any[])
          .map((e) =>
            typeof (e as any)?.subject_profession_id === "string"
              ? (e as any).subject_profession_id
              : professionByUserId.get((e as any).user_id)?.role_id || null
          )
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
              .is("department_profession_id", null)
              .eq("is_active", true)
          : Promise.resolve({ data: [], error: null }),
        entryProfessionIds.length > 0
          ? adminSupabase
              .from("role_questions")
              .select("department_profession_id")
              .in("department_profession_id", entryProfessionIds)
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
      const roleId = typeof row?.department_profession_id === "string" ? row.department_profession_id : null
      if (!roleId) return
      roleQuestionCountByRoleId.set(roleId, (roleQuestionCountByRoleId.get(roleId) || 0) + 1)
    })

    // Enrich entries with user profiles and custom responses
    const enrichedEntries = (entries as any[]).map((entry) => {
      const submittedByUserId =
        typeof entry.submitted_by_user_id === "string" && entry.submitted_by_user_id ? entry.submitted_by_user_id : entry.user_id
      const professionId =
        typeof entry.subject_profession_id === "string"
          ? entry.subject_profession_id
          : professionByUserId.get(entry.user_id)?.role_id || null
      const professionName =
        roleMap.get(professionId || "") ||
        professionByUserId.get(entry.user_id)?.role_name ||
        accessRoleByUserId.get(entry.user_id)?.role_name ||
        null
      const departmentId =
        typeof (entry as any)?.subject_department_id === "string"
          ? (entry as any).subject_department_id
          : typeof (entry as any)?.department_id === "string"
            ? (entry as any).department_id
            : null
      const deptQuestionCount = departmentId ? deptQuestionCountByDepartmentId.get(departmentId) || 0 : 0
      const roleQuestionCount = professionId ? roleQuestionCountByRoleId.get(professionId) || 0 : 0

      return {
        ...entry,
        user_profile: userMap.get(submittedByUserId) || null,
        custom_responses: responsesMap.get(entry.id) || [],
        profession_role_id: professionId,
        profession_role_name: professionName,
        effective_department_role_name: professionName,
        total_questions: deptQuestionCount + roleQuestionCount,
      }
    })

    // Return enriched entries along with filter options
    return NextResponse.json({
      entries: enrichedEntries,
      users: normalizedUsers,
      roles: (allRoles as any[])?.map((r) => ({ id: r.id, name: r.label })) || [],
      departments: (allDepartments as any[])?.map((d) => ({ id: d.id, name: d.name })) || [],
    })
  } catch (error) {
    console.error("Unexpected error in GET /api/admin/captain-log-entries:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
