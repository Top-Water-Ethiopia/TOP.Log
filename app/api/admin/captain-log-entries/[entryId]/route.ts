import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { adminSupabase } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

export async function GET(_request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  try {
    const supabase = await createClient()

    let userData: { data: { user: any }; error: any } | null = null
    try {
      const userPromise = supabase.auth.getUser()
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Auth check timeout")), 5000))

      userData = (await Promise.race([userPromise, timeoutPromise])) as {
        data: { user: any }
        error: any
      }
    } catch {
      return NextResponse.json({ error: "Authentication timeout" }, { status: 500 })
    }

    const {
      data: { user },
      error: authError,
    } = userData || { data: { user: null }, error: "Unknown error" }

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let profileData: { data: any; error: any } | null = null
    try {
      const profilePromise = supabase.from("user_profiles").select("role_id, is_active").eq("user_id", user.id).single()

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Profile check timeout")), 5000)
      )

      profileData = (await Promise.race([profilePromise, timeoutPromise])) as { data: any; error: any }
    } catch {
      return NextResponse.json({ error: "Profile check timeout" }, { status: 500 })
    }

    const { data: profile, error: profileError } = profileData || ({ data: null, error: "Unknown error" } as any)

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    const isActive = (profile as any).is_active === true
    const isAdmin =
      ((profile as any).role_id === ADMIN_ROLE_ID || (profile as any).role_id === SYSTEM_ADMIN_ROLE_ID) && isActive
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const { entryId } = await params

    const { data: entry, error: entryError } = await adminSupabase
      .from("captain_log_entries")
      .select("*")
      .eq("id", entryId)
      .single()

    if (entryError || !entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    const submittedByUserId =
      typeof (entry as any).submitted_by_user_id === "string" && (entry as any).submitted_by_user_id
        ? (entry as any).submitted_by_user_id
        : (entry as any).user_id

    const { data: userProfile } = await adminSupabase
      .from("user_profiles")
      .select("user_id, name, role_id, department_id")
      .eq("user_id", submittedByUserId)
      .single()

    let email = ""
    try {
      const { data: authUserData } = await adminSupabase.auth.admin.getUserById(submittedByUserId)
      email = authUserData?.user?.email || ""
    } catch {
      email = ""
    }

    const roleId = (userProfile as any)?.role_id
    const departmentId = (userProfile as any)?.department_id

    const [{ data: roleRow }, { data: deptRow }] = await Promise.all([
      roleId
        ? adminSupabase.from("roles").select("name").eq("id", roleId).single()
        : Promise.resolve({ data: null } as any),
      ((entry as any).subject_department_id as string | null) || departmentId
        ? adminSupabase
            .from("departments")
            .select("name")
            .eq("id", ((entry as any).subject_department_id as string | null) || departmentId)
            .single()
        : Promise.resolve({ data: null } as any),
    ])

    const subjectProfessionId =
      typeof (entry as any).subject_profession_id === "string" ? (entry as any).subject_profession_id : null
    const { data: subjectProfessionRow } = subjectProfessionId
      ? await adminSupabase.from("department_professions").select("label").eq("id", subjectProfessionId).single()
      : ({ data: null } as any)

    const { data: customResponses } = await adminSupabase
      .from("custom_responses")
      .select("*")
      .eq("entry_id", entryId)
      .order("timestamp")

    return NextResponse.json({
      entry: {
        ...(entry as any),
        user_profile: userProfile
          ? {
              user_id: (userProfile as any).user_id,
              name: (userProfile as any).name || "Unknown User",
              email,
              role_name: roleRow?.name || "Unknown",
              department_name: deptRow?.name || null,
            }
          : null,
        subject: {
          department_name: deptRow?.name || null,
          profession_name: subjectProfessionRow?.label || null,
        },
        custom_responses: (customResponses as any[]) || [],
      },
    })
  } catch (error) {
    console.error("Unexpected error in GET /api/admin/captain-log-entries/[entryId]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ entryId: string }> }) {
  try {
    const supabase = await createClient()

    let userData: { data: { user: any }; error: any } | null = null
    try {
      const userPromise = supabase.auth.getUser()
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Auth check timeout")), 5000))

      userData = (await Promise.race([userPromise, timeoutPromise])) as {
        data: { user: any }
        error: any
      }
    } catch {
      return NextResponse.json({ error: "Authentication timeout" }, { status: 500 })
    }

    const {
      data: { user },
      error: authError,
    } = userData || { data: { user: null }, error: "Unknown error" }

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let profileData: { data: any; error: any } | null = null
    try {
      const profilePromise = supabase.from("user_profiles").select("role_id, is_active").eq("user_id", user.id).single()

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Profile check timeout")), 5000)
      )

      profileData = (await Promise.race([profilePromise, timeoutPromise])) as { data: any; error: any }
    } catch {
      return NextResponse.json({ error: "Profile check timeout" }, { status: 500 })
    }

    const { data: profile, error: profileError } = profileData || ({ data: null, error: "Unknown error" } as any)

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    // Delete is restricted to the Admin role only (not system-admin).
    const isAdmin = (profile as any).role_id === ADMIN_ROLE_ID && (profile as any).is_active === true
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const { entryId } = await params

    const { data: existingEntry, error: existingEntryError } = await adminSupabase
      .from("captain_log_entries")
      .select("id")
      .eq("id", entryId)
      .maybeSingle()

    if (existingEntryError) {
      return NextResponse.json(
        { error: "Failed to check entry existence", details: existingEntryError },
        { status: 500 }
      )
    }

    if (!existingEntry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    // Use adminSupabase to bypass RLS when an admin performs deletes from the admin UI.
    const { data: deletedEntries, error: deleteError } = await adminSupabase
      .from("captain_log_entries")
      .delete()
      .eq("id", entryId)
      .select("id")

    if (deleteError) {
      return NextResponse.json({ error: "Failed to delete entry", details: deleteError }, { status: 500 })
    }

    if (!deletedEntries || deletedEntries.length === 0) {
      return NextResponse.json({ error: "Forbidden: Delete not permitted" }, { status: 403 })
    }

    return NextResponse.json({ ok: true, id: entryId })
  } catch (error) {
    console.error("Unexpected error in DELETE /api/admin/captain-log-entries/[entryId]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
