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
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get("departmentId")?.trim() || ""
    const date = searchParams.get("date")?.trim() || ""

    if (!departmentId || !date) {
      return NextResponse.json({ error: "departmentId and date are required" }, { status: 400 })
    }

    if (!isValidDate(date)) {
      return NextResponse.json({ error: "A valid YYYY-MM-DD date is required" }, { status: 400 })
    }

    const hasAccess = await userCanAccessDepartment(supabase, user.id, departmentId)
    if (!hasAccess) {
      return NextResponse.json({ error: "You do not have access to that department" }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("captain_log_entries")
      .select("id")
      .eq("submitted_by_user_id", user.id)
      .eq("entry_kind", "standard")
      .eq("subject_department_id", departmentId)
      .eq("date", date)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: "Failed to check existing report availability", message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: {
        existingStandardEntryId: typeof data?.id === "string" ? data.id : null,
      },
    })
  } catch (error) {
    console.error("Unexpected error loading entry availability:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
