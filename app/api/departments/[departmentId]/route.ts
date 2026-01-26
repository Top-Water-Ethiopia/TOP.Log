import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyAnyPermission } from "@/lib/rbac/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const perm = await verifyAnyPermission([
      "departments.read",
      "departments.members.read",
      "departments.members.manage",
      "admin.system",
    ])
    if (!perm.ok) {
      return NextResponse.json({ error: perm.error }, { status: perm.status })
    }

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

    const { data, error } = await supabase
      .from("departments")
      .select("id, name, description, is_active")
      .eq("id", departmentId)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Department not found" }, { status: 404 })
      }
      return NextResponse.json({ error: "Failed to load department", message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
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
