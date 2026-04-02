import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermission } from "@/lib/rbac/server"
import type { UserWithProfile, PaginatedUsersResponse } from "@/lib/supabase/admin.types"
import { normalizeEthiopianPhone } from "@/lib/auth/identifier"

// Enable dynamic route behavior
// This ensures we get fresh data on each request
export const dynamic = "force-dynamic"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeAdminIdentifiers(email?: unknown, phone?: unknown) {
  const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : undefined
  const trimmedPhone = typeof phone === "string" ? phone.trim() : undefined

  const normalizedEmail = trimmedEmail ? trimmedEmail : null
  const normalizedPhone = trimmedPhone ? normalizeEthiopianPhone(trimmedPhone) : null

  return {
    normalizedEmail,
    normalizedPhone,
    rawEmailProvided: typeof email === "string",
    rawPhoneProvided: typeof phone === "string",
    rawEmail: trimmedEmail ?? "",
    rawPhone: trimmedPhone ?? "",
  }
}

interface DepartmentRoleData {
  department_role_id: string | null
  user_id: string
  role: string
  is_active: boolean
  updated_at: string
}

async function clearUserOwnershipReferences(userId: string) {
  const updates: Array<{ table: string; column: string }> = [
    { table: "departments", column: "created_by" },
    { table: "departments", column: "updated_by" },
    { table: "user_department_professions", column: "created_by" },
    { table: "user_department_professions", column: "updated_by" },
  ]

  for (const u of updates) {
    try {
      const { error } = await (adminSupabase as any)
        .from(u.table)
        .update({ [u.column]: null })
        .eq(u.column, userId)
      if (error) {
        console.warn(`Failed to clear ${u.table}.${u.column} references for user ${userId}:`, error)
      }
    } catch (e) {
      console.warn(`Failed to clear ${u.table}.${u.column} references for user ${userId}:`, e)
    }
  }
}

async function deleteUserDependentRecords(userId: string) {
  try {
    const { data: entryIds, error: entriesSelectError } = await adminSupabase
      .from("captain_log_entries")
      .select("id")
      .eq("user_id", userId)

    if (!entriesSelectError && entryIds && entryIds.length > 0) {
      const ids = entryIds.map((e: any) => e.id)
      const { error: customResponsesDeleteError } = await adminSupabase
        .from("custom_responses")
        .delete()
        .in("entry_id", ids)

      if (customResponsesDeleteError) {
        console.warn("Failed to delete custom responses for user entries:", customResponsesDeleteError)
      }
    }

    const { error: entriesDeleteError } = await adminSupabase.from("captain_log_entries").delete().eq("user_id", userId)

    if (entriesDeleteError) {
      console.warn("Failed to delete captain log entries for user:", entriesDeleteError)
    }
  } catch (e) {
    console.warn("Failed to delete captain log related records for user:", e)
  }

  try {
    const { error } = await adminSupabase.from("user_department_professions").delete().eq("user_id", userId)

    if (error) {
      console.warn("Failed to delete user department professions for user:", error)
    }
  } catch (e) {
    console.warn("Failed to delete user department professions for user:", e)
  }

  try {
    const { error } = await adminSupabase.from("user_profiles").delete().eq("user_id", userId)

    if (error) {
      console.warn("Failed to delete user profile for user:", error)
    }
  } catch (e) {
    console.warn("Failed to delete user profile for user:", e)
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await verifyPermission("admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const userIdToDelete = searchParams.get("user_id")

    if (!userIdToDelete) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Prevent users from deleting themselves
    if (userIdToDelete === auth.userId) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 })
    }

    // Get the user's role to prevent deleting admin accounts
    const { data: userProfile, error: profileError } = await adminSupabase
      .from("user_profiles")
      .select("role_id")
      .eq("user_id", userIdToDelete)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    // Clear blocking created_by/updated_by references
    await clearUserOwnershipReferences(userIdToDelete)

    // Delete dependent rows that can block auth.users deletion (FK constraints)
    await deleteUserDependentRecords(userIdToDelete)

    let { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userIdToDelete)
    if (deleteError) {
      await clearUserOwnershipReferences(userIdToDelete)
      await deleteUserDependentRecords(userIdToDelete)
      ;({ error: deleteError } = await adminSupabase.auth.admin.deleteUser(userIdToDelete))
    }

    if (deleteError) {
      console.error("Error deleting auth user:", deleteError)
      const message =
        deleteError.message === "Database error deleting user"
          ? "Cannot delete user because they are referenced by existing records. Remove or transfer ownership and try again."
          : deleteError.message
      return NextResponse.json({ error: "Failed to delete user", message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "User deleted successfully" }, { status: 200 })
  } catch (error) {
    console.error("Delete user error:", error)
    return NextResponse.json(
      {
        error: "Failed to delete user",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await verifyPermission("admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { email, phone, password, name, role_id, department_id } = body
    const { normalizedEmail, normalizedPhone, rawEmail, rawPhone } = normalizeAdminIdentifiers(email, phone)

    // Validate required fields
    if ((!normalizedEmail && !normalizedPhone) || !password || !name) {
      return NextResponse.json(
        { error: "At least one of email or phone number is required, along with password and name" },
        { status: 400 }
      )
    }

    if (rawEmail && !EMAIL_REGEX.test(rawEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    if (rawPhone && !normalizedPhone) {
      return NextResponse.json({ error: "Enter a valid Ethiopian phone number" }, { status: 400 })
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    // Create user in Supabase Auth using admin client
    // Supabase will automatically check for duplicate emails and return an error if the email exists
    const { data: authData, error: createUserError } = await adminSupabase.auth.admin.createUser({
      ...(normalizedEmail ? { email: normalizedEmail, email_confirm: true } : {}),
      ...(normalizedPhone ? { phone: normalizedPhone, phone_confirm: true } : {}),
      password,
    })

    if (createUserError) {
      console.error("Error creating auth user:", createUserError)

      // Check if the error is due to duplicate email
      if (
        createUserError.message?.toLowerCase().includes("already") ||
        createUserError.message?.toLowerCase().includes("exists") ||
        createUserError.message?.toLowerCase().includes("duplicate") ||
        createUserError.status === 422
      ) {
        return NextResponse.json(
          {
            error:
              normalizedEmail && normalizedPhone
                ? "A user with this email or phone number already exists"
                : normalizedEmail
                  ? "User with this email already exists"
                  : "User with this phone number already exists",
            message: createUserError.message,
          },
          { status: 409 }
        )
      }

      return NextResponse.json({ error: "Failed to create user", message: createUserError.message }, { status: 500 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
    }

    // Create user profile using admin client (bypasses RLS)
    const defaultRoleId = role_id || "00000000-0000-0000-0000-000000000002" // Default to user role

    // Use the department_id directly
    const departmentId = department_id || null

    const { data: profile, error: profileError } = await adminSupabase
      .from("user_profiles")
      .insert({
        user_id: authData.user.id,
        name: name.trim(),
        department_id: departmentId,
        role_id: defaultRoleId,
        is_active: true,
        phone_e164: normalizedPhone,
      })
      .select()
      .single()

    if (profileError) {
      // If profile creation fails, try to clean up the auth user
      console.error("Error creating user profile:", profileError)
      try {
        await adminSupabase.auth.admin.deleteUser(authData.user.id)
      } catch (deleteError) {
        console.error("Error cleaning up auth user:", deleteError)
      }

      return NextResponse.json(
        { error: "Failed to create user profile", message: profileError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        user: {
          id: authData.user.id,
          email: authData.user.email ?? null,
          phone: authData.user.phone ?? null,
          identifier:
            authData.user.email || authData.user.phone || normalizedEmail || normalizedPhone || authData.user.id,
          created_at: authData.user.created_at,
        },
        profile,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Admin create user API error:", error)
    return NextResponse.json(
      {
        error: "Failed to create user",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// PUT - Update a user
export async function PUT(request: Request) {
  try {
    const auth = await verifyPermission("admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { user_id, name, email, phone, department_id, role_id, is_active } = body

    if (!user_id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const { data: targetProfile, error: targetProfileError } = await adminSupabase
      .from("user_profiles")
      .select("role_id")
      .eq("user_id", user_id)
      .single()

    if (targetProfileError || !targetProfile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    // Validate name if provided
    if (name !== undefined && !name.trim()) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 })
    }

    let authUser:
      | {
          id: string
          email?: string | null
          phone?: string | null
          created_at?: string | null
        }
      | null
      | undefined
    const authLookup = await adminSupabase.auth.admin.getUserById(user_id)
    authUser = authLookup.data.user

    if (!authUser) {
      return NextResponse.json({ error: "Auth user not found" }, { status: 404 })
    }

    const { normalizedEmail, normalizedPhone, rawEmailProvided, rawPhoneProvided, rawEmail, rawPhone } =
      normalizeAdminIdentifiers(email, phone)

    if (rawEmailProvided && rawEmail && !EMAIL_REGEX.test(rawEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    if (rawPhoneProvided && rawPhone && !normalizedPhone) {
      return NextResponse.json({ error: "Enter a valid Ethiopian phone number" }, { status: 400 })
    }

    const nextEmail = rawEmailProvided ? normalizedEmail : authUser.email || null
    const nextPhone = rawPhoneProvided ? normalizedPhone : authUser.phone || null

    if (!nextEmail && !nextPhone) {
      return NextResponse.json({ error: "At least one of email or phone number is required" }, { status: 400 })
    }

    const removingExistingEmail = rawEmailProvided && !normalizedEmail && !!authUser.email
    const removingExistingPhone = rawPhoneProvided && !normalizedPhone && !!authUser.phone

    if (removingExistingEmail || removingExistingPhone) {
      return NextResponse.json(
        { error: "Removing an existing email or phone number is not supported from this screen yet." },
        { status: 400 }
      )
    }

    const { data: existingUsers } = await adminSupabase.auth.admin.listUsers()
    const emailTaken = nextEmail ? existingUsers?.users?.some((u) => u.id !== user_id && u.email === nextEmail) : false
    const phoneTaken = nextPhone ? existingUsers?.users?.some((u) => u.id !== user_id && u.phone === nextPhone) : false

    if (emailTaken || phoneTaken) {
      return NextResponse.json(
        {
          error:
            emailTaken && phoneTaken
              ? "Email and phone number are already in use"
              : emailTaken
                ? "Email is already in use by another user"
                : "Phone number is already in use by another user",
        },
        { status: 409 }
      )
    }

    const { error: identifierError } = await adminSupabase.auth.admin.updateUserById(user_id, {
      ...(nextEmail && nextEmail !== authUser.email ? { email: nextEmail } : {}),
      ...(nextPhone && nextPhone !== authUser.phone ? { phone: nextPhone } : {}),
    })

    if (identifierError) {
      console.error("Error updating user identifiers:", identifierError)
      return NextResponse.json(
        { error: "Failed to update user identifiers", message: identifierError.message },
        { status: 500 }
      )
    }

    // Update user profile
    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (department_id !== undefined) {
      // Use the department_id directly
      updateData.department_id = department_id || null
    }
    if (role_id !== undefined) updateData.role_id = role_id
    if (is_active !== undefined) updateData.is_active = is_active
    updateData.phone_e164 = nextPhone
    updateData.updated_at = new Date().toISOString()

    const { data: profile, error: profileError } = await adminSupabase
      .from("user_profiles")
      .update(updateData)
      .eq("user_id", user_id)
      .select(
        `
        *,
        roles:role_id (
          id,
          name,
          description
        )
      `
      )
      .single()

    if (profileError) {
      console.error("Error updating user profile:", profileError)
      return NextResponse.json(
        { error: "Failed to update user profile", message: profileError.message },
        { status: 500 }
      )
    }

    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    // Get updated auth user data
    const refreshedAuthLookup = await adminSupabase.auth.admin.getUserById(user_id)
    authUser = refreshedAuthLookup.data.user

    return NextResponse.json({
      user: {
        id: authUser?.id || user_id,
        email: authUser?.email || null,
        phone: authUser?.phone || null,
        identifier: authUser?.email || authUser?.phone || user_id,
        created_at: authUser?.created_at,
      },
      profile,
    })
  } catch (error) {
    console.error("Admin update user API error:", error)
    return NextResponse.json(
      {
        error: "Failed to update user",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const auth = await verifyPermission("admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    // Parse pagination parameters from the URL
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "10")))
    const offset = (page - 1) * perPage

    // First, get the total count of all user profiles for pagination
    const { count: totalCount, error: countError } = await adminSupabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true })

    if (countError) throw countError

    // Fetch paginated user profiles with their role information
    const { data: profiles, error: profilesError } = await adminSupabase
      .from("user_profiles")
      .select(
        `
        id,
        user_id,
        name,
        department_id,
        role_id,
        is_active,
        created_at,
        updated_at,
        last_login,
        roles:role_id (
          id,
          name,
          description
        )
      `
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1)

    if (profilesError) throw profilesError

    // If no profiles found, return empty result
    if (!profiles || profiles.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: {
          page,
          perPage,
          totalCount: 0,
          totalPages: 0,
        },
      } as PaginatedUsersResponse)
    }

    const profileUserIds = profiles
      .map((profile: any) => profile.user_id)
      .filter((userId: string | null) => typeof userId === "string" && userId.trim().length > 0)

    let professionAssignments: Array<{
      user_id: string | null
      role_id: string | null
      is_active: boolean | null
      role?: { name?: string | null } | null
    }> = []

    if (profileUserIds.length > 0) {
      const { data: departmentRolesData, error: departmentRolesError } = await adminSupabase
        .from("user_department_professions")
        .select("user_id, role, department_role_id, is_active, updated_at")
        .in("user_id", profileUserIds)
        .order("is_active", { ascending: false })
        .order("updated_at", { ascending: false })

      if (departmentRolesError) {
        console.error("Error fetching department roles:", departmentRolesError)
      } else {
        const rows = (departmentRolesData || []) as unknown as DepartmentRoleData[]
        const professionIds = Array.from(
          new Set(rows.map((item) => item.department_role_id).filter((id): id is string => typeof id === "string"))
        )
        const professionKeys = Array.from(
          new Set(rows.map((item) => item.role).filter((key): key is string => typeof key === "string" && !!key))
        )

        const professionFilters = [
          professionIds.length > 0 ? `id.in.(${professionIds.join(",")})` : null,
          professionKeys.length > 0 ? `key.in.(${professionKeys.join(",")})` : null,
        ].filter(Boolean)

        const { data: professionRows, error: professionError } =
          professionFilters.length > 0
            ? await adminSupabase
                .from("department_professions")
                .select("id, key, label")
                .or(professionFilters.join(","))
            : { data: [], error: null }

        if (professionError) {
          console.error("Error fetching department profession labels:", professionError)
        }

        const labelById = new Map((professionRows || []).map((item) => [item.id, item.label]))
        const labelByKey = new Map((professionRows || []).map((item) => [item.key, item.label]))

        professionAssignments = (departmentRolesData || []).map((item: DepartmentRoleData) => ({
          user_id: item.user_id,
          role_id: item.role,
          is_active: item.is_active,
          role: { name: labelById.get(item.department_role_id || "") || labelByKey.get(item.role) || null },
        }))
      }
    }

    const professionByUserId = new Map<string, { role_id: string | null; role_name: string | null }>()
    for (const assignment of professionAssignments) {
      if (!assignment?.user_id || !assignment.is_active) continue
      if (professionByUserId.has(assignment.user_id)) continue
      professionByUserId.set(assignment.user_id, {
        role_id: assignment.role_id ?? null,
        role_name: assignment.role?.name ?? null,
      })
    }

    // Get auth data for all users in one go
    const {
      data: { users: authUsers = [] },
      error: authError,
    } = await adminSupabase.auth.admin.listUsers()

    if (authError) throw authError

    // Create a map of user IDs to auth data for quick lookup
    const authUsersMap = new Map(authUsers.map((user) => [user.id, user]))

    // Combine the profile data with auth data
    const usersWithAuth: UserWithProfile[] = profiles.map((profile: any) => {
      const authUser = authUsersMap.get(profile.user_id)
      const profession = profile.user_id ? professionByUserId.get(profile.user_id) : null

      return {
        id: profile.user_id,
        email: authUser?.email || null,
        phone: authUser?.phone || null,
        identifier: authUser?.email || authUser?.phone || profile.name,
        email_confirmed_at: authUser?.email_confirmed_at || null,
        user_metadata: authUser?.user_metadata || null,
        created_at: authUser?.created_at || profile.created_at,
        last_sign_in_at: authUser?.last_sign_in_at || null,
        profile: {
          id: profile.id,
          name: profile.name,
          department_id: profile.department_id,
          role_id: profile.role_id,
          role_name: profile.roles?.name || "user",
          profession_role_id: profession?.role_id ?? null,
          profession_role_name: profession?.role_name ?? null,
          is_active: profile.is_active,
          created_at: profile.created_at,
          last_login: profile.last_login,
        },
      }
    })

    // Return the paginated response
    const response: PaginatedUsersResponse = {
      data: usersWithAuth,
      pagination: {
        page,
        perPage,
        totalCount: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / perPage),
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Admin users API error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch users",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
