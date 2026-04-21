import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveEntryKinds } from "@/lib/entry-kinds/resolve"

export const dynamic = "force-dynamic"

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

async function userCanAccessDepartment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  departmentId: string
) {
  const { data: memberships, error: membershipError } = await supabase
    .from("user_department_memberships")
    .select("department_id")
    .eq("user_id", userId)
    .eq("department_id", departmentId)
    .eq("is_active", true)
    .limit(1)

  if (membershipError) {
    throw membershipError
  }

  if ((memberships || []).length > 0) {
    return { allowed: true, membershipCount: (memberships || []).length, rpcAllowed: null as boolean | null }
  }

  // Fallback to security-definer function (bypasses RLS) for cases where RLS filters the membership row.
  // Use ANY active membership, not just access_level, since reporting is available to department members.
  const { data: hasAccess, error: accessError } = await supabase.rpc("has_department_membership", {
    p_user_id: userId,
    p_department_id: departmentId,
  })

  if (accessError) {
    throw accessError
  }

  return { allowed: hasAccess === true, membershipCount: 0, rpcAllowed: hasAccess === true }
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
    let accessCheck: { allowed: boolean; membershipCount: number; rpcAllowed: boolean | null }
    try {
      accessCheck = await userCanAccessDepartment(supabase, user.id, departmentId)
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

    if (!accessCheck.allowed) {
      console.warn(`[entry-availability] Access denied for user ${user.id} to department ${departmentId}. No active membership found.`)
      return NextResponse.json(
        { 
          error: "Access denied", 
          message: "You do not have an active membership in this department",
          ...(process.env.NODE_ENV !== "production"
            ? {
                debug: {
                  userId: user.id,
                  departmentId,
                  membershipCount: accessCheck.membershipCount,
                  rpcAllowed: accessCheck.rpcAllowed,
                },
              }
            : {}),
        }, 
        { status: 403 }
      )
    }
    console.log(`[entry-availability] Access granted, querying captain_log_entries...`)

    let allowMultiplePerDay = false
    try {
      const previewProfessionRoleId = role && looksLikeUuid(role) ? role : null
      const previewProfessionKey = role && !looksLikeUuid(role) ? role : null
      const resolved = await resolveEntryKinds({
        system: "personal",
        departmentId,
        userId: user.id,
        professionRoleId: previewProfessionRoleId,
        professionKey: previewProfessionKey,
      })
      const configs = Array.isArray(resolved.data) ? resolved.data : []
      const match = configs.find((c: any) => String(c.entry_kind) === entryKind)
      allowMultiplePerDay = match?.allow_multiple_per_day === true
    } catch (e) {
      console.error("[entry-availability] Failed to resolve entry kinds:", e)
      allowMultiplePerDay = false
    }

    if (allowMultiplePerDay) {
      return NextResponse.json({
        data: {
          existingEntryId: null,
          existingStandardEntryId: null,
          allowMultiplePerDay: true,
        },
      })
    }

    console.log(`[entry-availability] Querying captain_log_entries for user=${user.id}, kind=${entryKind}, dept=${departmentId}, date=${date}`)
    const queryStart = Date.now()
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
    const queryDuration = Date.now() - queryStart
    console.log(`[entry-availability] Query completed in ${queryDuration}ms. Found: ${data?.id || "none"}`)

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
