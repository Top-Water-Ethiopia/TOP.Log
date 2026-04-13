import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermissionFromRequest } from "@/lib/rbac/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data, error } = await adminSupabase
      .from("roles")
      .select("id, name, display_name, description, level, is_active, created_at, updated_at")
      .eq("type", "access_level")
      .eq("scope", "system")
      .order("level", { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: "Failed to load department access levels", message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load department access levels",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({}))
    const { name, display_name, description, level } = body

    if (!name || !display_name || level === undefined) {
      return NextResponse.json({ error: "name, display_name, and level are required" }, { status: 400 })
    }

    const { data, error } = await adminSupabase
      .from("roles")
      .insert({
        type: "access_level",
        scope: "system",
        name,
        display_name,
        description: description || null,
        level,
      })
      .select("id, name, display_name, description, level, is_active, created_at, updated_at")
      .single()

    if (error) {
      const status = error.code === "23505" ? 409 : 500
      return NextResponse.json(
        { error: "Failed to create department access level", message: error.message },
        { status }
      )
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create department access level",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({}))
    const { id, name, display_name, description, level, is_active } = body

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) updates.name = name
    if (display_name !== undefined) updates.display_name = display_name
    if (description !== undefined) updates.description = description
    if (level !== undefined) updates.level = level
    if (is_active !== undefined) updates.is_active = is_active

    const { data, error } = await adminSupabase
      .from("roles")
      .update(updates)
      .eq("id", id)
      .eq("type", "access_level")
      .eq("scope", "system")
      .select("id, name, display_name, description, level, is_active, created_at, updated_at")
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: "Failed to update department access level", message: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json({ error: "Department access level not found" }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update department access level",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const url = new URL(request.url)
    const id = (url.searchParams.get("id") || "").trim()

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    // Check for active memberships using this role
    const { data: assignments, error: assignmentsError } = await adminSupabase
      .from("user_department_memberships")
      .select("id")
      .eq("role_id", id)
      .eq("is_active", true)
      .limit(1)

    if (assignmentsError) {
      console.error("Error checking role assignments:", assignmentsError)
    }

    if (assignments && assignments.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete access level. It has users assigned. Please reassign users first." },
        { status: 409 }
      )
    }

    const { error } = await adminSupabase
      .from("roles")
      .delete()
      .eq("id", id)
      .eq("type", "access_level")
      .eq("scope", "system")
    if (error) {
      return NextResponse.json(
        { error: "Failed to delete department access level", message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete department access level",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
