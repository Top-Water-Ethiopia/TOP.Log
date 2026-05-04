import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermissionFromRequest } from "@/lib/rbac/server"

// Enable dynamic route behavior
export const dynamic = "force-dynamic"

// GET - List all departments
export async function GET(request: Request) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data: departments, error } = await adminSupabase
      .from("departments")
      .select("*")
      .order("name", { ascending: true })

    if (error) {
      console.error("Error fetching departments:", error)
      return NextResponse.json({ error: "Failed to fetch departments", message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: departments || [] })
  } catch (error) {
    console.error("Admin departments API error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch departments",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// POST - Create a new department
export async function POST(request: Request) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { name, description, is_active } = body

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Department name is required" }, { status: 400 })
    }

    // Check if department with same name already exists (case-insensitive)
    const { data: allDepartments } = await adminSupabase.from("departments").select("id, name")

    const existing = allDepartments?.find((d) => d.name.toLowerCase() === name.trim().toLowerCase())

    if (existing) {
      return NextResponse.json({ error: "A department with this name already exists" }, { status: 409 })
    }

    // Create department using admin client (bypasses RLS)
    const { data: department, error } = await adminSupabase
      .from("departments")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        is_active: is_active !== false,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .select("*")
      .single()

    if (error) {
      console.error("Error creating department:", error)
      return NextResponse.json({ error: "Failed to create department", message: error.message }, { status: 500 })
    }

    // Note: Department role permissions are now managed via defaults and overrides UI.
    // No automatic seeding is performed on department creation.

    return NextResponse.json({ data: department }, { status: 201 })
  } catch (error) {
    console.error("Admin create department API error:", error)
    return NextResponse.json(
      {
        error: "Failed to create department",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// PUT - Update a department
export async function PUT(request: Request) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { id, name, description, is_active } = body

    if (!id) {
      return NextResponse.json({ error: "Department ID is required" }, { status: 400 })
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Department name is required" }, { status: 400 })
    }

    // Check if another department with same name exists (case-insensitive)
    const { data: allDepartments } = await adminSupabase.from("departments").select("id, name")

    const existing = allDepartments?.find((d) => d.id !== id && d.name.toLowerCase() === name.trim().toLowerCase())

    if (existing) {
      return NextResponse.json({ error: "A department with this name already exists" }, { status: 409 })
    }

    // Update department using admin client
    const { data: department, error } = await adminSupabase
      .from("departments")
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        is_active: is_active !== false,
        updated_by: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single()

    if (error) {
      console.error("Error updating department:", error)
      return NextResponse.json({ error: "Failed to update department", message: error.message }, { status: 500 })
    }

    if (!department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 })
    }

    return NextResponse.json({ data: department })
  } catch (error) {
    console.error("Admin update department API error:", error)
    return NextResponse.json(
      {
        error: "Failed to update department",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// DELETE - Delete a department
export async function DELETE(request: Request) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Department ID is required" }, { status: 400 })
    }

    // Check if department has any roles assigned
    const { data: roles, error: rolesError } = await adminSupabase
      .from("roles")
      .select("id")
      .eq("department_id", id)
      .limit(1)

    if (rolesError) {
      console.error("Error checking roles:", rolesError)
      // Continue with deletion attempt
    }

    if (roles && roles.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete department. It has roles assigned. Please remove all roles first." },
        { status: 409 }
      )
    }

    // Check if department has any users assigned (even if UI filters them out)
    const { count: userCount, error: usersError } = await adminSupabase
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("department_id", id)

    if (usersError) {
      console.error("Error checking department users:", usersError)
      // Continue with deletion attempt
    }

    if (typeof userCount === "number" && userCount > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete department",
          message: `This department still has ${userCount} team member${userCount === 1 ? "" : "s"} assigned to it. Move them to another department (or remove their department assignment) and try again.`,
        },
        { status: 409 }
      )
    }

    // Delete department using admin client
    const { error } = await adminSupabase.from("departments").delete().eq("id", id)

    if (error) {
      console.error("Error deleting department:", error)

      const errorMessage = typeof error.message === "string" ? error.message : ""
      const errorCode =
        typeof (error as unknown as { code?: unknown }).code === "string"
          ? (error as unknown as { code: string }).code
          : null

      if (errorCode === "23503" || errorMessage.includes("violates foreign key constraint")) {
        if (errorMessage.includes("user_profiles_department_id_fkey")) {
          return NextResponse.json(
            {
              error: "Cannot delete department",
              message:
                "This department still has team members assigned to it. Move those users to another department (or remove their department assignment) and try again.",
            },
            { status: 409 }
          )
        }

        return NextResponse.json(
          {
            error: "Cannot delete department",
            message: "This department is still in use. Remove anything linked to it and try again.",
          },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: "Failed to delete department", message: errorMessage || "Unknown error" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin delete department API error:", error)
    return NextResponse.json(
      {
        error: "Failed to delete department",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
