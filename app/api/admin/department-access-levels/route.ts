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
      .from("department_access_levels")
      .select("*")
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
      .from("department_access_levels")
      .insert({
        name,
        display_name,
        description: description || null,
        level,
      })
      .select()
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
      .from("department_access_levels")
      .update(updates)
      .eq("id", id)
      .select()
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

    const { error } = await adminSupabase.from("department_access_levels").delete().eq("id", id)
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
