import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermission } from "@/lib/rbac/server"

export const dynamic = "force-dynamic"

function parsePermissionName(name: string) {
  const trimmed = name.trim()
  const idx = trimmed.indexOf(".")
  if (idx <= 0 || idx === trimmed.length - 1) {
    return null
  }

  const resource = trimmed.slice(0, idx).trim().toLowerCase()
  const action = trimmed
    .slice(idx + 1)
    .trim()
    .toLowerCase()

  if (!resource || !action) {
    return null
  }

  if (/\s/.test(resource) || /\s/.test(action)) {
    return null
  }

  return {
    resource,
    action,
  }
}

export async function GET(request: Request) {
  try {
    const auth = await verifyPermission("admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const roleId = searchParams.get("role_id")

    if (!roleId) {
      return NextResponse.json({ error: "role_id is required" }, { status: 400 })
    }

    const { data: perms, error } = await adminSupabase
      .from("role_permissions")
      .select("*")
      .eq("role_id", roleId)
      .order("resource", { ascending: true })
      .order("action", { ascending: true })

    if (error) {
      console.error("Error fetching permissions:", error)
      return NextResponse.json({ error: "Failed to fetch permissions", message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: perms || [] })
  } catch (error) {
    console.error("Admin permissions API error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch permissions",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await verifyPermission("admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const roleId: string | undefined = body?.role_id
    const permissionNames: unknown = body?.permissions

    if (!roleId) {
      return NextResponse.json({ error: "role_id is required" }, { status: 400 })
    }

    if (!Array.isArray(permissionNames)) {
      return NextResponse.json({ error: "permissions must be an array" }, { status: 400 })
    }

    const cleaned = permissionNames
      .filter((p): p is string => typeof p === "string")
      .map((p) => p.trim())
      .filter(Boolean)

    const invalid: string[] = []
    const canonical = new Map<string, { resource: string; action: string }>()

    cleaned.forEach((name) => {
      const parsed = parsePermissionName(name)
      if (!parsed) {
        invalid.push(name)
        return
      }

      canonical.set(`${parsed.resource}.${parsed.action}`, parsed)
    })

    if (invalid.length > 0) {
      return NextResponse.json(
        { error: "Invalid permission name(s)", invalid: Array.from(new Set(invalid)) },
        {
          status: 400,
        }
      )
    }

    const parsed = Array.from(canonical.values())

    const { data: role, error: roleError } = await adminSupabase.from("roles").select("id").eq("id", roleId).single()

    if (roleError || !role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 })
    }

    // Clear existing role_permissions
    const { error: deleteError } = await adminSupabase.from("role_permissions").delete().eq("role_id", roleId)

    if (deleteError) {
      console.error("Error clearing permissions:", deleteError)
      return NextResponse.json({ error: "Failed to update permissions", message: deleteError.message }, { status: 500 })
    }

    if (parsed.length > 0) {
      const { error: insertError } = await adminSupabase.from("role_permissions").insert(
        parsed.map((p) => ({
          role_id: roleId,
          resource: p.resource,
          action: p.action,
          effect: "allow" as const, // Standard effect for this API
        }))
      )

      if (insertError) {
        console.error("Error inserting permissions:", insertError)
        return NextResponse.json(
          { error: "Failed to update permissions", message: insertError.message },
          { status: 500 }
        )
      }
    }

    const { data: updated, error: fetchError } = await adminSupabase
      .from("role_permissions")
      .select("*")
      .eq("role_id", roleId)
      .order("resource", { ascending: true })
      .order("action", { ascending: true })

    if (fetchError) {
      console.error("Error fetching updated permissions:", fetchError)
      return NextResponse.json({ data: [] })
    }

    return NextResponse.json({ data: updated || [] })
  } catch (error) {
    console.error("Admin update permissions API error:", error)
    return NextResponse.json(
      {
        error: "Failed to update permissions",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
