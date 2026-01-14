import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { isAdmin: false, error: "Not authenticated" }
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role_id")
    .eq("user_id", user.id)
    .single()

  if (profileError || !profile) {
    return { isAdmin: false, error: "Admin access required" }
  }

  const isAdmin = profile.role_id === ADMIN_ROLE_ID || profile.role_id === SYSTEM_ADMIN_ROLE_ID

  if (!isAdmin) {
    return { isAdmin: false, error: "Admin access required" }
  }

  return { isAdmin: true, userId: user.id, roleId: profile.role_id }
}

export async function GET() {
  try {
    const { isAdmin, error: authError } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Admin access required" }, { status: 403 })
    }

    const fromRows = (rowsRaw: unknown) => {
      const rows = (rowsRaw || []) as Array<{ resource: string | null; action: string | null }>

      return Array.from(
        new Set(
          rows
            .map(
              (p) =>
                `${String(p.resource || "")
                  .trim()
                  .toLowerCase()}.${String(p.action || "")
                  .trim()
                  .toLowerCase()}`
            )
            .filter((p) => typeof p === "string" && p.length > 1 && p.includes("."))
        )
      ).sort((a, b) => a.localeCompare(b))
    }

    const { data: defsRaw, error: defsError } = await adminSupabase
      .from("permission_definitions")
      .select("resource, action")

    // Fallback for environments where the migration isn't applied yet.
    if (defsError) {
      const msg = String(defsError.message || "")
      const missingTable = msg.toLowerCase().includes("does not exist")
      if (!missingTable) {
        console.error("Error fetching permission definitions:", defsError)
        return NextResponse.json(
          { error: "Failed to fetch permissions catalog", message: defsError.message },
          { status: 500 }
        )
      }
    }

    const defs = fromRows(defsRaw)

    if (defs.length > 0) {
      return NextResponse.json({ data: defs })
    }

    const { data: assignedRaw, error: assignedError } = await adminSupabase
      .from("permissions")
      .select("resource, action")

    if (assignedError) {
      console.error("Error fetching permissions catalog:", assignedError)
      return NextResponse.json(
        { error: "Failed to fetch permissions catalog", message: assignedError.message },
        { status: 500 }
      )
    }

    const names = fromRows(assignedRaw)

    return NextResponse.json({ data: names })
  } catch (error) {
    console.error("Admin permissions catalog API error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch permissions catalog",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
