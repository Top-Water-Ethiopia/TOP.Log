import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermissionForDepartmentFromRequest } from "@/lib/rbac/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const { departmentId } = await params

    if (!departmentId) {
      return NextResponse.json({ error: "Department ID is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const readAuth = await verifyPermissionForDepartmentFromRequest(request, "departments.read", departmentId)
    const adminAuth = readAuth.ok ? null : await verifyPermissionForDepartmentFromRequest(request, "admin.system", departmentId)

    if (!readAuth.ok && !adminAuth?.ok) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Load department details
    const { data: dept, error: deptError } = await supabase
      .from("departments")
      .select("id, name, description, is_active")
      .eq("id", departmentId)
      .single()

    if (deptError || !dept) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 })
    }

    return NextResponse.json({ data: dept })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const { departmentId } = await params

    if (!departmentId) {
      return NextResponse.json({ error: "Department ID is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description } = body

    if (name === undefined && description === undefined) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const updateAuth = await verifyPermissionForDepartmentFromRequest(request, "departments.update", departmentId)
    if (!updateAuth.ok) return NextResponse.json({ error: updateAuth.error }, { status: updateAuth.status })

    // Update department details
    const updates: Record<string, any> = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    updates.updated_at = new Date().toISOString()

    const { data: updatedDept, error: updateError } = await adminSupabase
      .from("departments")
      .update(updates)
      .eq("id", departmentId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: "Failed to update department", message: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ data: updatedDept })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
