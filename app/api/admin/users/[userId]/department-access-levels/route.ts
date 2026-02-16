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
      .from("user_department_access_levels")
      .select(
        `
        *,
        department:departments(id, name),
        access_level:department_access_levels(id, name, display_name, level)
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: "Failed to load user department access levels", message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: data || [] })
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

    const { data, error } = await adminSupabase
      .from("user_department_access_levels")
      .upsert(
        {
          user_id: userId,
          department_id,
          access_level_id,
          assigned_by: auth.userId,
        },
        {
          onConflict: "user_id,department_id",
          ignoreDuplicates: false,
        }
      )
      .select(
        `
        *,
        department:departments(id, name),
        access_level:department_access_levels(id, name, display_name, level)
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

    // If the join didn't populate access_level, fetch it explicitly
    let result = data
    if (result && !result.access_level) {
      const { data: fetchedAccessLevel } = await adminSupabase
        .from("department_access_levels")
        .select("id, name, display_name, level")
        .eq("id", result.access_level_id)
        .single()
      if (fetchedAccessLevel) {
        result.access_level = fetchedAccessLevel
      }
    }

    return NextResponse.json({ data: result }, { status: 201 })
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
      .from("user_department_access_levels")
      .delete()
      .eq("id", assignmentId)
      .eq("user_id", userId)

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
