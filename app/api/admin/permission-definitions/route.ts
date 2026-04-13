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

  if (!resource || !action) return null
  if (/\s/.test(resource) || /\s/.test(action)) return null

  return { resource, action }
}

export async function GET() {
  try {
    const auth = await verifyPermission("admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data, error } = await adminSupabase
      .from("permission_definitions")
      .select("id, resource, action, description, scope, created_at, updated_at")
      .order("resource", { ascending: true })
      .order("action", { ascending: true })

    if (error) {
      console.error("Error fetching permission definitions:", error)
      return NextResponse.json(
        { error: "Failed to fetch permission definitions", message: error.message },
        { status: 500 }
      )
    }

    const rows = (data || []) as Array<{
      id: string
      resource: string
      action: string
      description: string | null
      scope: string
    }>
    const mapped = rows.map((r) => ({ ...r, name: `${r.resource}.${r.action}` }))

    return NextResponse.json({ data: mapped })
  } catch (error) {
    console.error("Admin permission definitions API error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch permission definitions",
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
    const name: unknown = body?.name
    const description: unknown = body?.description
    const scope: unknown = body?.scope

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }

    const parsed = parsePermissionName(name)
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid permission name", message: "Must look like resource.action" },
        { status: 400 }
      )
    }

    const validScopes = ["system", "department", "both"]
    const finalScope = typeof scope === "string" && validScopes.includes(scope) ? scope : "both"

    const { data, error } = await adminSupabase
      .from("permission_definitions")
      .insert({
        resource: parsed.resource,
        action: parsed.action,
        description: typeof description === "string" ? description.trim() || null : null,
        scope: finalScope,
      })
      .select("id, resource, action, description, scope, created_at, updated_at")
      .single()

    if (error) {
      console.error("Error creating permission definition:", error)
      const status = error.code === "23505" ? 409 : 500
      return NextResponse.json({ error: "Failed to create permission", message: error.message }, { status })
    }

    return NextResponse.json({ data: { ...data, name: `${data.resource}.${data.action}` } }, { status: 201 })
  } catch (error) {
    console.error("Admin create permission definition API error:", error)
    return NextResponse.json(
      {
        error: "Failed to create permission",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await verifyPermission("admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const id: unknown = body?.id
    const description: unknown = body?.description
    const scope: unknown = body?.scope

    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const update: { description?: string | null; scope?: string; updated_at: string } = {
      updated_at: new Date().toISOString(),
    }

    if (typeof description === "string") {
      update.description = description.trim() || null
    }

    const validScopes = ["system", "department", "both"]
    if (typeof scope === "string" && validScopes.includes(scope)) {
      update.scope = scope
    }

    const { data, error } = await adminSupabase
      .from("permission_definitions")
      .update(update)
      .eq("id", id)
      .select("id, resource, action, description, scope, created_at, updated_at")
      .single()

    if (error) {
      console.error("Error updating permission definition:", error)
      return NextResponse.json({ error: "Failed to update permission", message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: { ...data, name: `${data.resource}.${data.action}` } })
  } catch (error) {
    console.error("Admin update permission definition API error:", error)
    return NextResponse.json(
      {
        error: "Failed to update permission",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await verifyPermission("admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const { data: def, error: defError } = await adminSupabase
      .from("permission_definitions")
      .select("id, resource, action")
      .eq("id", id)
      .single()

    if (defError || !def) {
      return NextResponse.json({ error: "Permission not found" }, { status: 404 })
    }

    // Delete from unified role permissions
    const { error: deleteAssignmentsError } = await adminSupabase
      .from("role_permissions")
      .delete()
      .eq("resource", def.resource)
      .eq("action", def.action)

    if (deleteAssignmentsError) {
      console.error("Error deleting permission assignments:", deleteAssignmentsError)
      return NextResponse.json(
        { error: "Failed to delete permission assignments", message: deleteAssignmentsError.message },
        { status: 500 }
      )
    }

    const { error: deleteDefError } = await adminSupabase.from("permission_definitions").delete().eq("id", id)

    if (deleteDefError) {
      console.error("Error deleting permission definition:", deleteDefError)
      return NextResponse.json(
        { error: "Failed to delete permission", message: deleteDefError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: { id, removed: true } })
  } catch (error) {
    console.error("Admin delete permission definition API error:", error)
    return NextResponse.json(
      {
        error: "Failed to delete permission",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
