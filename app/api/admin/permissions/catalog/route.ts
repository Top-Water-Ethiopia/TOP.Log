import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermission } from "@/lib/rbac/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const auth = await verifyPermission("admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
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
      .select("id, resource, action, description, scope")

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

    if (defsRaw && defsRaw.length > 0) {
      const mapped = defsRaw.map((d) => ({
        ...d,
        name: `${d.resource}.${d.action}`,
      }))
      return NextResponse.json({ data: mapped })
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
