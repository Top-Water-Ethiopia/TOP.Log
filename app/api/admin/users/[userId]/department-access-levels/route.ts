import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermissionFromRequest } from "@/lib/rbac/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const auth = await verifyPermissionFromRequest(request, "users.read")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { userId } = await params

    const { data, error } = await adminSupabase
      .from("user_department_memberships")
      .select(
        `
        *,
        department:departments(id, name),
        access_level:roles(id, name, display_name, level)
      `
      )
      .eq("user_id", userId)
      .eq("membership_type", "access_level")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: "Failed to load user department access levels", message: error.message },
        { status: 500 }
      )
    }

    // Adapt to legacy response format if needed
    const adapted = (data || []).map((row) => ({
      ...row,
      access_level_id: row.role_id,
    }))

    return NextResponse.json({ data: adapted })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load user department access levels",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const auth = await verifyPermissionFromRequest(request, "users.manage")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { userId } = await params

    const body = await request.json().catch(() => ({}))
    const { department_id, access_level_id } = body

    if (!department_id || !access_level_id) {
      return NextResponse.json({ error: "department_id and access_level_id are required" }, { status: 400 })
    }

    // For access levels, we generally want one per department. 
    // Check if one already exists to update it, or create a new one.
    const { data: existing } = await adminSupabase
      .from("user_department_memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("department_id", department_id)
      .eq("membership_type", "access_level")
      .maybeSingle()

    let query
    if (existing) {
      query = adminSupabase
        .from("user_department_memberships")
        .update({
          role_id: access_level_id,
          is_active: true,
          updated_by: auth.userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
    } else {
      query = adminSupabase
        .from("user_department_memberships")
        .insert({
          user_id: userId,
          department_id,
          membership_type: "access_level",
          role_id: access_level_id,
          is_active: true,
          created_by: auth.userId,
          updated_by: auth.userId,
        })
    }

    const { data, error } = await query
      .select(
        `
        *,
        department:departments(id, name),
        access_level:roles(id, name, display_name, level)
      `
      )
      .single()

    if (error) {
      const status = error.code === "23505" ? 409 : 500
      return NextResponse.json(
        { error: "Failed to assign department access level", message: error.message },
        { status }
      )
    }

    const adapted = {
      ...data,
      access_level_id: data.role_id,
    }

    return NextResponse.json({ data: adapted }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to assign department access level",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const auth = await verifyPermissionFromRequest(request, "users.manage")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { userId } = await params

    const body = await request.json().catch(() => ({}))
    const { department_id, is_active } = body

    if (!department_id || typeof is_active !== "boolean") {
      return NextResponse.json({ error: "department_id and is_active (boolean) are required" }, { status: 400 })
    }

    const { data, error } = await adminSupabase
      .from("user_department_memberships")
      .update({ 
        is_active, 
        updated_by: auth.userId,
        updated_at: new Date().toISOString() 
      })
      .eq("user_id", userId)
      .eq("department_id", department_id)
      .eq("membership_type", "access_level")
      .select(
        `
        *,
        department:departments(id, name),
        access_level:roles(id, name, display_name, level)
      `
      )
      .single()

    if (error) {
      return NextResponse.json(
        { error: "Failed to update access level status", message: error.message },
        { status: 500 }
      )
    }

    const adapted = {
      ...data,
      access_level_id: data.role_id,
    }

    return NextResponse.json({ data: adapted })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update access level status",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const auth = await verifyPermissionFromRequest(request, "users.manage")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { userId } = await params

    const url = new URL(request.url)
    const assignmentId = url.searchParams.get("assignmentId")

    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required" }, { status: 400 })
    }

    const { error } = await adminSupabase
      .from("user_department_memberships")
      .delete()
      .eq("id", assignmentId)
      .eq("user_id", userId)
      .eq("membership_type", "access_level")

    if (error) {
      return NextResponse.json(
        { error: "Failed to remove department access level", message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to remove department access level",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
