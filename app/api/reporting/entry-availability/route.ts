import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}

async function userCanAccessDepartment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  departmentId: string
) {
  const [{ data: professionAssignment, error: professionError }, { data: accessAssignments, error: accessError }] =
    await Promise.all([
      supabase
        .from("user_department_professions")
        .select("department_id")
        .eq("user_id", userId)
        .eq("department_id", departmentId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("user_department_access_levels")
        .select("department_id")
        .eq("user_id", userId)
        .eq("department_id", departmentId)
        .limit(1),
    ])

  if (professionError) {
    throw professionError
  }

  if (professionAssignment?.department_id === departmentId) {
    return true
  }

  if (accessError) {
    throw accessError
  }

  return (accessAssignments || []).some((assignment) => assignment.department_id === departmentId)
}

export async function GET(request: Request) {
  console.log(`[entry-availability] Received request: ${request.url}`)
  try {
    console.log("[entry-availability] Creating Supabase client...")
    const supabase = await createClient()

    console.log("[entry-availability] Getting user...")
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("[entry-availability] Auth error:", authError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.log(`[entry-availability] User authenticated: ${user.id}`)

    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get("departmentId")?.trim() || ""
    const date = searchParams.get("date")?.trim() || ""
    const entryKind = searchParams.get("entryKind")?.trim() || "standard"
    const role = searchParams.get("role")?.trim() || ""
    console.log(`[entry-availability] Params: departmentId=${departmentId}, date=${date}, entryKind=${entryKind}, role=${role}`)

    if (!departmentId || !date) {
      console.error("[entry-availability] Missing required params")
      return NextResponse.json({ error: "departmentId and date are required" }, { status: 400 })
    }

    if (!isValidDate(date)) {
      console.error("[entry-availability] Invalid date format:", date)
      return NextResponse.json({ error: "A valid YYYY-MM-DD date is required" }, { status: 400 })
    }

    console.log(`[entry-availability] Checking department access for user ${user.id} and department ${departmentId}`)
    let hasAccess: boolean
    try {
      hasAccess = await userCanAccessDepartment(supabase, user.id, departmentId)
    } catch (accessError) {
      console.error("[entry-availability] Error in userCanAccessDepartment:", accessError)
      return NextResponse.json(
        {
          error: "Failed to verify department access",
          message: accessError instanceof Error ? accessError.message : "Unknown error",
        },
        { status: 500 }
      )
    }

    if (!hasAccess) {
      console.warn(`[entry-availability] Access denied for user ${user.id} to department ${departmentId}`)
      return NextResponse.json({ error: "You do not have access to that department" }, { status: 403 })
    }
    console.log(`[entry-availability] Access granted, querying captain_log_entries...`)

    const scopeConfigQuery = (supabase as any)
      .from("scope_entry_kinds")
      .select("allow_multiple_per_day")
      .eq("department_id", departmentId)
      .eq("entry_kind", entryKind)
      .limit(1)

    if (role) {
      scopeConfigQuery.eq("department_profession_id", role)
    } else {
      scopeConfigQuery.is("department_profession_id", null)
    }

    const { data: scopeConfig, error: scopeConfigError } = await scopeConfigQuery.maybeSingle()

    if (scopeConfigError) {
      console.error("[entry-availability] Scope config query error:", scopeConfigError)
      return NextResponse.json(
        { error: "Failed to load entry kind configuration", message: scopeConfigError.message },
        { status: 500 }
      )
    }

    const allowMultiplePerDay = scopeConfig?.allow_multiple_per_day === true

    if (allowMultiplePerDay) {
      return NextResponse.json({
        data: {
          existingEntryId: null,
          existingStandardEntryId: null,
          allowMultiplePerDay: true,
        },
      })
    }

    const { data, error } = await supabase
      .from("captain_log_entries")
      .select("id")
      .eq("submitted_by_user_id", user.id)
      .eq("entry_kind", entryKind)
      .eq("subject_department_id", departmentId)
      .eq("date", date)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error("[entry-availability] Query error:", error)
      return NextResponse.json(
        { error: "Failed to check existing report availability", message: error.message },
        { status: 500 }
      )
    }

    console.log(`[entry-availability] Query successful, found: ${data?.id || "none"}`)
    return NextResponse.json({
      data: {
        existingEntryId: typeof data?.id === "string" ? data.id : null,
        existingStandardEntryId: entryKind === "standard" && typeof data?.id === "string" ? data.id : null,
        allowMultiplePerDay: false,
      },
    })
  } catch (error) {
    console.error("[entry-availability] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
